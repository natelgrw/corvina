package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const (
	datasetDir = "dataset"
	port       = ":5001"
)

// ---------- Global DB ----------

var db *sql.DB

// ---------- JSON Types ----------

// Incoming annotation from frontend
type RawAnnotation struct {
	ID                 string      `json:"id"`
	Order              int         `json:"order"`
	Type               string      `json:"type"`
	Label              string      `json:"label"`
	BBox               []int       `json:"bbox,omitempty"`
	Position           []int       `json:"position,omitempty"`
	Points             interface{} `json:"points,omitempty"`
	SourceID           string      `json:"source_id,omitempty"`
	TargetID           string      `json:"target_id,omitempty"`
	RawText            string      `json:"raw_text,omitempty"`
	IsIgnored          bool        `json:"is_ignored"`
	LinkedAnnotationID string      `json:"linked_annotation_id,omitempty"`
	LabelName          string      `json:"label_name,omitempty"`
	Values             []Value     `json:"values,omitempty"`
	TranscriptionBox   []int       `json:"transcription_box,omitempty"`
}

type Value struct {
	Val        string `json:"value"`
	UnitPrefix string `json:"unit_prefix"`
	UnitSuffix string `json:"unit_suffix"`
}

type SubmitPayload struct {
	DocumentID     string            `json:"document_id"`
	PDFFile        string            `json:"pdf_file"`
	NumPages       int               `json:"num_pages"`
	Classification map[string]string `json:"classification"`
	Annotations    []RawAnnotation   `json:"annotations"`
}

// Output types
type Component struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	BBox  []int  `json:"bbox"`
}

type Node struct {
	ID       string `json:"id"`
	Position []int  `json:"position"`
}

type Connection struct {
	ID       string      `json:"id"`
	SourceID string      `json:"source_id"`
	TargetID string      `json:"target_id"`
	Type     string      `json:"type,omitempty"`
	Points   interface{} `json:"points,omitempty"`
}

type Graph struct {
	Components  []Component  `json:"components"`
	Nodes       []Node       `json:"nodes"`
	Connections []Connection `json:"connections"`
}

type TextAnnotation struct {
	ID        string  `json:"id"`
	BBox      []int   `json:"bbox"`
	RawText   string  `json:"raw_text"`
	IsIgnored bool    `json:"is_ignored"`
	LinkedTo  string  `json:"linked_to,omitempty"`
	LabelName string  `json:"label_name,omitempty"`
	Values    []Value `json:"values,omitempty"`
}

type OutputJSON struct {
	ImageFile       string            `json:"image_file"`
	Classification  map[string]string `json:"classification"`
	Graph           Graph             `json:"graph"`
	TextAnnotations []TextAnnotation  `json:"text_annotations"`
}

// ---------- Database ----------

func connectDB() *sql.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	var conn *sql.DB
	var err error

	// Retry loop — Postgres may take a few seconds to start in Docker
	for i := 0; i < 30; i++ {
		conn, err = sql.Open("pgx", dsn)
		if err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			err = conn.PingContext(ctx)
			cancel()
			if err == nil {
				log.Println("Connected to PostgreSQL")
				conn.SetMaxOpenConns(10)
				conn.SetMaxIdleConns(5)
				conn.SetConnMaxLifetime(5 * time.Minute)
				return conn
			}
		}
		log.Printf("Waiting for PostgreSQL... (%d/30)", i+1)
		time.Sleep(1 * time.Second)
	}

	log.Fatalf("Failed to connect to PostgreSQL after 30 attempts: %v", err)
	return nil
}

// intArrayToPg converts an int slice to a PostgreSQL array literal
func intArrayToPg(arr []int) string {
	if len(arr) == 0 {
		return "{}"
	}
	parts := make([]string, len(arr))
	for i, v := range arr {
		parts[i] = fmt.Sprintf("%d", v)
	}
	return "{" + strings.Join(parts, ",") + "}"
}

// ---------- CORS Middleware ----------

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ---------- Response Helpers ----------

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	jsonResponse(w, status, map[string]string{"error": msg})
}

// ---------- Handlers ----------

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}

	// 32 MB max
	r.ParseMultipartForm(32 << 20)

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, http.StatusBadRequest, "No file part")
		return
	}
	defer file.Close()

	filename := header.Filename
	if filename == "" {
		jsonError(w, http.StatusBadRequest, "No selected file")
		return
	}

	if !strings.HasSuffix(strings.ToLower(filename), ".png") {
		jsonError(w, http.StatusBadRequest, "Only .png files are allowed")
		return
	}

	// doc_id = filename without extension
	docID := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Save to dataset directory (filesystem)
	docDir := filepath.Join(datasetDir, docID)
	os.MkdirAll(docDir, 0755)

	savePath := filepath.Join(docDir, filename)
	dst, err := os.Create(savePath)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	io.Copy(dst, file)

	// Insert into PostgreSQL (upsert — handle re-uploads)
	_, err = db.Exec(`
		INSERT INTO documents (document_id, image_file, drawing_type, source)
		VALUES ($1, $2, 'handwritten', 'notebook')
		ON CONFLICT (document_id) DO UPDATE SET image_file = $2
	`, docID, filename)
	if err != nil {
		log.Printf("DB insert error (document): %v", err)
		// Non-fatal — file is already saved, log and continue
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"status":      "success",
		"document_id": docID,
		"pdf_file":    filename,
		"num_pages":   1,
		"classification": map[string]string{
			"type":   "handwritten",
			"domain": "notebook",
		},
		"pages": []map[string]interface{}{
			{"page_number": 1, "image_file": filename},
		},
	})
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}

	var payload SubmitPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if payload.DocumentID == "" {
		jsonError(w, http.StatusBadRequest, "Missing document_id")
		return
	}

	// Verify document exists in DB
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM documents WHERE document_id = $1)", payload.DocumentID).Scan(&exists)
	if err != nil || !exists {
		jsonError(w, http.StatusNotFound, fmt.Sprintf("Document %s not found. Please upload again.", payload.DocumentID))
		return
	}

	// Update classification in documents table
	if payload.Classification != nil {
		drawingType := payload.Classification["type"]
		source := payload.Classification["domain"]
		if drawingType != "" || source != "" {
			db.Exec("UPDATE documents SET drawing_type = $1, source = $2 WHERE document_id = $3",
				drawingType, source, payload.DocumentID)
		}
	}

	// Begin transaction for all annotation data
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback() // no-op if committed

	// Clear previous annotations for this document (supports re-submission)
	tx.Exec("DELETE FROM components WHERE document_id = $1", payload.DocumentID)
	tx.Exec("DELETE FROM nodes WHERE document_id = $1", payload.DocumentID)
	tx.Exec("DELETE FROM connections WHERE document_id = $1", payload.DocumentID)
	tx.Exec("DELETE FROM text_annotations WHERE document_id = $1", payload.DocumentID)

	// Counters for logging
	var nComponents, nNodes, nConnections, nText int

	for i := range payload.Annotations {
		ann := &payload.Annotations[i]

		switch ann.Type {
		case "box":
			_, err = tx.Exec(
				"INSERT INTO components (id, document_id, label, bbox) VALUES ($1, $2, $3, $4)",
				ann.ID, payload.DocumentID, ann.Label, intArrayToPg(ann.BBox),
			)
			nComponents++

		case "node":
			_, err = tx.Exec(
				"INSERT INTO nodes (id, document_id, position) VALUES ($1, $2, $3)",
				ann.ID, payload.DocumentID, intArrayToPg(ann.Position),
			)
			nNodes++

		case "connection":
			_, err = tx.Exec(
				"INSERT INTO connections (id, document_id, source_id, target_id) VALUES ($1, $2, $3, $4)",
				ann.ID, payload.DocumentID, ann.SourceID, ann.TargetID,
			)
			nConnections++

		case "line":
			pointsJSON, _ := json.Marshal(ann.Points)
			_, err = tx.Exec(
				"INSERT INTO connections (id, document_id, source_id, target_id, type, points) VALUES ($1, $2, $3, $4, $5, $6)",
				ann.ID, payload.DocumentID, ann.SourceID, ann.TargetID, "line", string(pointsJSON),
			)
			nConnections++

		case "text":
			var valuesJSON []byte
			if len(ann.Values) > 0 {
				valuesJSON, _ = json.Marshal(ann.Values)
			}
			_, err = tx.Exec(
				"INSERT INTO text_annotations (id, document_id, bbox, raw_text, is_ignored, linked_to, label_name, values) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
				ann.ID, payload.DocumentID, intArrayToPg(ann.BBox), ann.RawText, ann.IsIgnored,
				ann.LinkedAnnotationID, ann.LabelName, nullableJSON(valuesJSON),
			)
			nText++
		}

		if err != nil {
			log.Printf("Insert error for annotation %s: %v", ann.ID, err)
			tx.Rollback()
			jsonError(w, http.StatusInternalServerError, "Failed to save annotation: "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	log.Printf("Saved to PostgreSQL: %s | Components: %d, Nodes: %d, Connections: %d, Text: %d",
		payload.DocumentID, nComponents, nNodes, nConnections, nText)

	jsonResponse(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Saved %s to database", payload.DocumentID),
	})
}

// nullableJSON returns nil for empty/null JSON payloads, or the string for valid ones
func nullableJSON(data []byte) interface{} {
	if data == nil || string(data) == "null" {
		return nil
	}
	return string(data)
}

// ---------- Query Endpoints ----------

func handleListDocuments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}

	rows, err := db.Query("SELECT document_id, image_file, drawing_type, source, created_at FROM documents ORDER BY created_at DESC")
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Query failed")
		return
	}
	defer rows.Close()

	type DocSummary struct {
		DocumentID  string `json:"document_id"`
		ImageFile   string `json:"image_file"`
		DrawingType string `json:"drawing_type"`
		Source      string `json:"source"`
		CreatedAt   string `json:"created_at"`
	}

	docs := []DocSummary{}
	for rows.Next() {
		var d DocSummary
		var createdAt time.Time
		if err := rows.Scan(&d.DocumentID, &d.ImageFile, &d.DrawingType, &d.Source, &createdAt); err != nil {
			continue
		}
		d.CreatedAt = createdAt.Format(time.RFC3339)
		docs = append(docs, d)
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"documents": docs,
		"count":     len(docs),
	})
}

func handleGetDocument(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}

	// Extract document_id from URL: /documents/some-id
	path := strings.TrimPrefix(r.URL.Path, "/documents/")
	docID := strings.TrimSpace(path)
	if docID == "" {
		jsonError(w, http.StatusBadRequest, "Missing document_id")
		return
	}

	// Check document exists
	var imageFile, drawingType, source string
	err := db.QueryRow("SELECT image_file, drawing_type, source FROM documents WHERE document_id = $1", docID).
		Scan(&imageFile, &drawingType, &source)
	if err != nil {
		jsonError(w, http.StatusNotFound, "Document not found")
		return
	}

	// Fetch components
	components := []Component{}
	compRows, _ := db.Query("SELECT id, label, bbox FROM components WHERE document_id = $1", docID)
	if compRows != nil {
		defer compRows.Close()
		for compRows.Next() {
			var c Component
			var bboxStr string
			if err := compRows.Scan(&c.ID, &c.Label, &bboxStr); err == nil {
				c.BBox = parsePgIntArray(bboxStr)
				components = append(components, c)
			}
		}
	}

	// Fetch nodes
	nodes := []Node{}
	nodeRows, _ := db.Query("SELECT id, position FROM nodes WHERE document_id = $1", docID)
	if nodeRows != nil {
		defer nodeRows.Close()
		for nodeRows.Next() {
			var n Node
			var posStr string
			if err := nodeRows.Scan(&n.ID, &posStr); err == nil {
				n.Position = parsePgIntArray(posStr)
				nodes = append(nodes, n)
			}
		}
	}

	// Fetch connections
	connections := []Connection{}
	connRows, _ := db.Query("SELECT id, source_id, target_id, type, points FROM connections WHERE document_id = $1", docID)
	if connRows != nil {
		defer connRows.Close()
		for connRows.Next() {
			var c Connection
			var connType, pointsJSON sql.NullString
			if err := connRows.Scan(&c.ID, &c.SourceID, &c.TargetID, &connType, &pointsJSON); err == nil {
				c.Type = connType.String
				if pointsJSON.Valid {
					json.Unmarshal([]byte(pointsJSON.String), &c.Points)
				}
				connections = append(connections, c)
			}
		}
	}

	// Fetch text annotations
	textAnns := []TextAnnotation{}
	textRows, _ := db.Query("SELECT id, bbox, raw_text, is_ignored, linked_to, label_name, values FROM text_annotations WHERE document_id = $1", docID)
	if textRows != nil {
		defer textRows.Close()
		for textRows.Next() {
			var ta TextAnnotation
			var bboxStr string
			var linkedTo, labelName sql.NullString
			var valuesJSON sql.NullString
			if err := textRows.Scan(&ta.ID, &bboxStr, &ta.RawText, &ta.IsIgnored, &linkedTo, &labelName, &valuesJSON); err == nil {
				ta.BBox = parsePgIntArray(bboxStr)
				ta.LinkedTo = linkedTo.String
				ta.LabelName = labelName.String
				if valuesJSON.Valid {
					json.Unmarshal([]byte(valuesJSON.String), &ta.Values)
				}
				textAnns = append(textAnns, ta)
			}
		}
	}

	output := OutputJSON{
		ImageFile:      imageFile,
		Classification: map[string]string{"type": drawingType, "domain": source},
		Graph: Graph{
			Components:  components,
			Nodes:       nodes,
			Connections: connections,
		},
		TextAnnotations: textAnns,
	}

	jsonResponse(w, http.StatusOK, output)
}

// parsePgIntArray parses a PostgreSQL int array string like "{1,2,3,4}" into []int
func parsePgIntArray(s string) []int {
	s = strings.Trim(s, "{}")
	if s == "" {
		return []int{}
	}
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		var v int
		fmt.Sscanf(strings.TrimSpace(p), "%d", &v)
		result = append(result, v)
	}
	return result
}

// ---------- Main ----------

func main() {
	os.MkdirAll(datasetDir, 0755)

	// Connect to PostgreSQL
	db = connectDB()
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/upload", handleUpload)
	mux.HandleFunc("/submit", handleSubmit)
	mux.HandleFunc("/documents", handleListDocuments)
	mux.HandleFunc("/documents/", handleGetDocument)

	server := &http.Server{
		Addr:         port,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("corvina backend (go) listening on %s", port)
	log.Fatal(server.ListenAndServe())
}
