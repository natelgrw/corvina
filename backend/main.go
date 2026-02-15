package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	datasetDir = "dataset"
	port       = ":5001"
)

// ---------- JSON Types ----------

// Incoming annotation from frontend
type RawAnnotation struct {
	ID                  string      `json:"id"`
	Order               int         `json:"order"`
	Type                string      `json:"type"`
	Label               string      `json:"label"`
	BBox                []int       `json:"bbox,omitempty"`
	Position            []int       `json:"position,omitempty"`
	Points              interface{} `json:"points,omitempty"`
	SourceID            string      `json:"source_id,omitempty"`
	TargetID            string      `json:"target_id,omitempty"`
	RawText             string      `json:"raw_text,omitempty"`
	IsIgnored           bool        `json:"is_ignored"`
	LinkedAnnotationID  string      `json:"linked_annotation_id,omitempty"`
	LabelName           string      `json:"label_name,omitempty"`
	Values              []Value     `json:"values,omitempty"`
	TranscriptionBox    []int       `json:"transcription_box,omitempty"`
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

// ---------- CORS Middleware ----------

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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

	// Save directly to dataset directory
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

	// Dataset directory (image already saved here by /upload)
	finalPath := filepath.Join(datasetDir, payload.DocumentID)
	if _, err := os.Stat(finalPath); os.IsNotExist(err) {
		jsonError(w, http.StatusNotFound, fmt.Sprintf("Document data not found for %s. Please upload again.", payload.DocumentID))
		return
	}

	// Restructure annotations — single pass, pre-allocated slices
	numAnns := len(payload.Annotations)
	components := make([]Component, 0, numAnns/3)
	nodes := make([]Node, 0, numAnns/4)
	connections := make([]Connection, 0, numAnns/3)
	textAnns := make([]TextAnnotation, 0, numAnns/4)

	for i := range payload.Annotations {
		ann := &payload.Annotations[i] // pointer to avoid copy

		switch ann.Type {
		case "box":
			components = append(components, Component{
				ID:    ann.ID,
				Label: ann.Label,
				BBox:  ann.BBox,
			})

		case "node":
			nodes = append(nodes, Node{
				ID:       ann.ID,
				Position: ann.Position,
			})

		case "connection":
			connections = append(connections, Connection{
				ID:       ann.ID,
				SourceID: ann.SourceID,
				TargetID: ann.TargetID,
			})

		case "text":
			ta := TextAnnotation{
				ID:        ann.ID,
				BBox:      ann.BBox,
				RawText:   ann.RawText,
				IsIgnored: ann.IsIgnored,
			}
			if ann.LinkedAnnotationID != "" {
				ta.LinkedTo = ann.LinkedAnnotationID
			}
			if ann.LabelName != "" {
				ta.LabelName = ann.LabelName
			}
			if len(ann.Values) > 0 {
				ta.Values = ann.Values
			}
			textAnns = append(textAnns, ta)

		case "line":
			connections = append(connections, Connection{
				ID:       ann.ID,
				Type:     "line",
				Points:   ann.Points,
				SourceID: ann.SourceID,
				TargetID: ann.TargetID,
			})
		}
	}

	imageFile := payload.PDFFile
	if imageFile == "" {
		imageFile = payload.DocumentID + ".png"
	}

	output := OutputJSON{
		ImageFile:      imageFile,
		Classification: payload.Classification,
		Graph: Graph{
			Components:  components,
			Nodes:       nodes,
			Connections: connections,
		},
		TextAnnotations: textAnns,
	}

	// Write JSON file
	jsonPath := filepath.Join(finalPath, payload.DocumentID+".json")
	f, err := os.Create(jsonPath)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to create JSON file: "+err.Error())
		return
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(output); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to write JSON: "+err.Error())
		return
	}

	log.Printf("Saved: %s/ | Components: %d, Nodes: %d, Connections: %d, Text: %d",
		finalPath, len(components), len(nodes), len(connections), len(textAnns))

	jsonResponse(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Saved to %s", jsonPath),
	})
}

// ---------- Main ----------

func main() {
	os.MkdirAll(datasetDir, 0755)

	mux := http.NewServeMux()
	mux.HandleFunc("/upload", handleUpload)
	mux.HandleFunc("/submit", handleSubmit)

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
