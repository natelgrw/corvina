
import re
import json

class HomeworkParser:
    """
    Parses a Markdown string containing structured math homework (Problem > Part > Content)
    into a hierarchical JSON object.
    
    Structure Mapping:
    - # Problem X  -> problems entry
    - ## a)        -> parts entry
    - ### i)       -> part content (or subpart if schema allows, currently treating as content)
    - Content      -> raw string
    """
    
    def __init__(self):
        # Regex Patterns
        self.problem_pattern = re.compile(r'^#+\s*(?:Problem\s+)?([0-9]+|[A-Z])(?!\))', re.IGNORECASE)
        self.part_pattern = re.compile(r'^#+\s*([a-z]|[0-9]+)\)', re.IGNORECASE)
        self.subpart_pattern = re.compile(r'^#+\s*([ivx]+)\)', re.IGNORECASE)
        self.tag_pattern = re.compile(r'^\{(bp_)?(\d+)\}(.*)', re.DOTALL)
        
        # Internal State
        self.problems = []
        self.current_problem = None
        self.current_part = None
        self.current_subpart = None
        
    def parse(self, markdown_string):
        lines = markdown_string.split('\n')
        for line in lines:
            self._process_line(line)
        self._finalize_current_blocks()
        
    def to_json(self):
        output = {"problems": self.problems}
        return json.dumps(output, indent=4)
        
    def _process_line(self, line):
        clean_line = line.strip()
        if not clean_line: return

        # 1. Match Structural Elements
        # Priority: Part/Subpart > Problem
        part_match = self.part_pattern.match(clean_line)
        if part_match:
            if not self.current_problem:
                # Part found before problem? Create a dummy problem if needed, or default to Preamble
                # But usually parts belong to problems. 
                # Let's ensure we have a current_problem
                self.current_problem = {
                    "problem_id": "Preamble",
                    "content_entries": [],
                    "parts": [],
                    "_temp_lines": [] 
                }
                self.problems.append(self.current_problem)
            
            self._finalize_current_part_and_subparts()
            self.current_part = {
                "part_id": part_match.group(1).replace(')', ''),
                "content_entries": [],
                "subparts": [],
                "_temp_lines": []
            }
            self.current_problem["parts"].append(self.current_part)
            return

        subpart_match = self.subpart_pattern.match(clean_line)
        if subpart_match and self.current_part:
            self._finalize_current_subpart()
            self.current_subpart = {
                "subpart_id": subpart_match.group(1).replace(')', ''),
                "content_entries": [],
                "_temp_lines": []
            }
            self.current_part["subparts"].append(self.current_subpart)
            return

        problem_match = self.problem_pattern.match(clean_line)
        if problem_match:
            self._finalize_current_blocks()
            self.current_problem = {
                "problem_id": problem_match.group(1),
                "content_entries": [],
                "parts": [],
                "_temp_lines": [] 
            }
            self.problems.append(self.current_problem)
            self.current_part = None
            self.current_subpart = None
            return

        # 2. Content Tags
        tag_match = self.tag_pattern.match(clean_line)
        if tag_match:
            is_bullet = bool(tag_match.group(1))
            level = int(tag_match.group(2))
            text = tag_match.group(3).strip()
            
            entry = {
                "type": "bullet" if is_bullet else "text",
                "level": level,
                "text": text
            }
            
            # Add to active block
            target = None
            if self.current_subpart: target = self.current_subpart
            elif self.current_part: target = self.current_part
            elif self.current_problem: target = self.current_problem
            else:
                # Headless content (before first problem)
                if not self.problems or "problem_id" in self.problems[0]:
                    self.current_problem = {
                        "problem_id": "Preamble",
                        "content_entries": [],
                        "parts": [],
                        "_temp_lines": []
                    }
                    self.problems.insert(0, self.current_problem)
                target = self.problems[0]
            
            target["content_entries"].append(entry)
            return # Added return to prevent falling through to fallback

        # 3. Fallback for untagged lines (Assume level 0 text)
        entry = {
            "type": "text",
            "level": 0,
            "text": clean_line
        }
        target = None
        if self.current_subpart: target = self.current_subpart
        elif self.current_part: target = self.current_part
        elif self.current_problem: target = self.current_problem
        else:
            if not self.problems:
                self.current_problem = {"problem_id": "Preamble", "content_entries": [], "parts": [], "_temp_lines": []}
                self.problems.append(self.current_problem)
            target = self.problems[0]
        
        target["content_entries"].append(entry)


    def _finalize_current_blocks(self):
        self._finalize_current_part_and_subparts()
        self._finalize_current_problem()
        self.current_problem = None
        
    def _finalize_current_part_and_subparts(self):
        self._finalize_current_subpart()
        self._finalize_current_part()
        
    def _finalize_current_subpart(self):
        if self.current_subpart:
            if "_temp_lines" in self.current_subpart: del self.current_subpart["_temp_lines"]
            # Compatibility: add joined content
            self.current_subpart["content"] = "\n".join([e["text"] for e in self.current_subpart["content_entries"]])
            self.current_subpart = None

    def _finalize_current_part(self):
        if self.current_part:
            if "_temp_lines" in self.current_part: del self.current_part["_temp_lines"]
            self.current_part["content"] = "\n".join([e["text"] for e in self.current_part["content_entries"]])
            self.current_part = None

    def _finalize_current_problem(self):
        if self.current_problem:
            if "_temp_lines" in self.current_problem: del self.current_problem["_temp_lines"]
            self.current_problem["content"] = "\n".join([e["text"] for e in self.current_problem["content_entries"]])

    @staticmethod
    def _clean_content(text):
        return text.strip()

