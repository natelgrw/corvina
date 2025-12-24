
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
        # Matches: "# Problem 1", "## Problem 1", or just "Problem 1" (robustness)
        self.problem_pattern = re.compile(r'^(?:#|##)?\s*Problem\s+(\d+)', re.IGNORECASE)
        
        # Matches: "## a)" or "## b)" or "### a)"
        self.part_pattern = re.compile(r'^(?:##|###)\s*([a-z]\))', re.IGNORECASE)
        
        # Matches: "### i)", "### ii)", etc.
        self.subpart_pattern = re.compile(r'^###\s*([ivx]+\))', re.IGNORECASE)
        
        # Proof Markers
        self.proof_start = r'\begin{proof}'
        self.proof_end = r'\end{proof}'
        
        # Internal State
        self.problems = []
        self.current_problem = None # Dict
        self.current_part = None    # Dict
        self.in_proof = False
        
    def parse(self, markdown_string):
        """
        Main entry point. Iterates line-by-line using a state machine.
        """
        lines = markdown_string.split('\n')
        
        for line in lines:
            line = line.rstrip() # Keep indentation if relevant, but typically strip right
            self._process_line(line)
            
        # Final cleanup after loop
        self._finalize_current_blocks()
        
    def to_json(self):
        """
        Exports the parsed structure to JSON.
        """
        output = {
            "problems": self.problems
        }
        return json.dumps(output, indent=4)
        
    def _process_line(self, line):
        clean_line = line.strip()
        
        # 1. Check for New Problem Header
        problem_match = self.problem_pattern.match(clean_line)
        if problem_match:
            self._finalize_current_blocks() # Close existing part & problem
            
            problem_id = problem_match.group(1)
            self.current_problem = {
                "problem_id": problem_id,
                "parts": []
            }
            self.problems.append(self.current_problem)
            return

        # 2. Check for New Part Header
        # Only valid if we have an active problem
        part_match = self.part_pattern.match(clean_line)
        if part_match and self.current_problem is not None:
            self._finalize_current_part() # Close existing part only
            
            part_id = part_match.group(1).replace(')', '') # remove ')' for ID? User said "e.g. 'a'".
            
            self.current_part = {
                "part_id": part_id,
                "content": "",
                "metadata": {
                    "has_proof": False,
                    "equation_count": 0
                },
                "_temp_lines": [] # Buffer for content
            }
            self.current_problem["parts"].append(self.current_part)
            # Reset proof state for new part
            self.in_proof = False
            return
            
        # 3. Handle Content (if inside a part)
        if self.current_part is not None:
            # Check for Proof Tags
            if self.proof_start in clean_line:
                self.current_part["metadata"]["has_proof"] = True
                self.in_proof = True
            
            if self.proof_end in clean_line:
                self.in_proof = False
                
            # Count Equations (naive check for $ or $$)
            # A line might have multiple '$', counting pairs roughly?
            # Or just check if line contains math. 
            # Prompt says: "equation_count (integer)".
            # Let's count occurrence of separate math blocks.
            # Simple heuristic: count occurrences of '$$' + pairs of '$'
            # Actually, standard regex for extracting math might be better, but let's stick to simple line checks for now.
            # We'll do a simple count of '$' and divide by 2? Or just 1 if present? 
            # "equation_count" implies count of equations.
            # I will count '$$' blocks and inline '$...$' separately.
            # For efficiency, I'll just count '$' characters / 2.
            self.current_part["metadata"]["equation_count"] += clean_line.count('$') // 2
            
            self.current_part["_temp_lines"].append(line)
            
        # If text appears before any part (e.g. Intro to Problem 1), we could attach to problem?
        # User schema only has parts. I will ignore orphan text in Problem or attach to last part.
        # Strict schema: "parts: A list of objects". No content field on Problem.
        # So I will ignore text that isn't inside a part.
            
    def _finalize_current_blocks(self):
        self._finalize_current_part()
        self.current_problem = None
        
    def _finalize_current_part(self):
        if self.current_part:
            content_lines = self.current_part["_temp_lines"]
            
            # Sanitization Step 4: Auto-close proof if missing
            # If we are strictly inside a proof (flag is true) and we are closing the part
            if self.in_proof:
               # Check if end tag is already in lines?
               # The flag tracks state. If True at finalization, we are missing a closing tag.
               content_lines.append(self.proof_end)
               self.in_proof = False
            
            # Join and clean
            raw_content = "\n".join(content_lines)
            self.current_part["content"] = self._clean_content(raw_content)
            
            # Remove temp buffer
            del self.current_part["_temp_lines"]
            
            self.current_part = None
            
    def _clean_content(self, text):
        """
        Strip leading/trailing whitespace.
        (Preserves internal LaTeX structure as we just joined unmodified lines)
        """
        return text.strip()
