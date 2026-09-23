import os
import re
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv()

class ChatAgent:
    def __init__(self):
        self.embeddings = NVIDIAEmbeddings(model="nvidia/llama-nemotron-embed-vl-1b-v2")
        self.llm = ChatNVIDIA(model="meta/llama-3.2-11b-vision-instruct", temperature=0.1)
        self.active_dbs = {}
        self.chat_histories = {}

    def _get_vector_db(self, repo_name):
        db_path = os.path.join("faiss_dbs", f"faiss_db_{repo_name}")
        if repo_name not in self.active_dbs:
            if not os.path.exists(db_path):
                return None
            self.active_dbs[repo_name] = FAISS.load_local(
                db_path, self.embeddings, allow_dangerous_deserialization=True
            )
        return self.active_dbs[repo_name]

    def _is_code_request(self, text):
        """Detects if the input contains actual code or an explicit audit/review request."""
        # Strong code indicators — multi-char patterns that won't appear in plain English
        code_patterns = [
            r'def\s+\w+\s*\(',       # Python function def
            r'class\s+\w+\s*[:\(]',  # Class definition
            r'async\s+def\s+\w+',    # Async function
            r'from\s+\w+\s+import',  # Python import
            r'import\s+\{[^}]+\}',   # JS named import
            r'function\s*\w*\s*\(',  # JS function
            r'const\s+\w+\s*=\s*(?:async\s*)?\(', # JS arrow fn
            r'if\s*\(.+\)\s*[\{:]',  # If statement with body
            r'for\s*\(.+\)\s*\{',    # For loop
            r'await\s+\w+',          # Async await
            r'```[\w\s]',            # Markdown code block
            r'SELECT\s+\*?\s*FROM',  # SQL
            r'@app\.\w+\(',          # FastAPI/Flask decorator
            r'@router\.\w+\(',       # FastAPI router
            r'<[A-Z]\w+[\s/>]',      # JSX component tag
            r'return\s+\{',          # Return object
        ]
        # Explicit audit / review keywords
        audit_keywords = [
            r'\baudit\b', r'\brefactor\b', r'\bvulnerability\b', r'\bsecurity\s+issue\b',
            r'\breview\s+(my|this|the)\s+code\b', r'\bcheck\s+(my|this)\s+code\b',
            r'\bis\s+(this|my)\s+code\s+safe\b',
        ]
        all_patterns = code_patterns + audit_keywords
        return any(re.search(p, text, re.IGNORECASE) for p in all_patterns)

    def ask_question(self, repo_name, question):
        try:
            vector_db = self._get_vector_db(repo_name)
            if not vector_db:
                raise FileNotFoundError("Database not found.")

            docs = vector_db.similarity_search(question, k=10)
            
            # FIX 1: Escape curly braces in retrieved code to prevent LangChain F-string errors
            # This stops errors like "Invalid variable name 'proxy.url.scheme'"
            context_parts = []
            for d in docs:
                source = d.metadata.get('source', 'unknown')
                content = d.page_content.replace("{", "{{").replace("}", "}}")
                context_parts.append(f"--- FILE: {source} ---\n{content}")
            
            context = "\n\n".join(context_parts)

            if repo_name not in self.chat_histories:
                self.chat_histories[repo_name] = []
            history = self.chat_histories[repo_name]

            is_audit = self._is_code_request(question)

            system_instruction = f"""You are AURA, an elite AI security and code audit system for the repository '{repo_name}'.

# REPOSITORY CONTEXT:
{{context}}

---

# OPERATING MODES

## MODE 1 — GENERAL ASSISTANCE
For architecture, explanation, or general questions: respond in Markdown with technical detail.

## MODE 2 — CODE AUDIT
When the user submits code for review, output EXACTLY the XML block below. No text before or after it.

### RISK_LEVEL rules (pick exactly one):
- SAFE   = code is correct, secure, and production-ready — no real issues found
- LOW    = trivial style or naming issue only; no security or logic risk
- MEDIUM = functional bug, logic error, or design flaw that would cause failures
- HIGH   = security vulnerability (SQL injection, auth bypass, data exposure) or data-loss risk

### ORIGINAL_CODE rule:
Paste the user's submitted code EXACTLY as written — character for character, zero changes.

### SAFE_CODE rules — MANDATORY:
You MUST write the actual corrected code in <SAFE_CODE>. This is not optional.
- SAFE   → Copy original + add 1-2 inline approval comments (e.g. # ✓ validated) showing it is correct.
- LOW    → Apply the minor fix and add a short inline comment explaining the change.
- MEDIUM → Rewrite the function or block to fully resolve the bug. The corrected code MUST differ from the original.
- HIGH   → Rewrite with the vulnerability eliminated, input validation added, and a security comment explaining the fix.

⛔ FORBIDDEN: Do NOT paste the original code unchanged into <SAFE_CODE> when risk is LOW, MEDIUM, or HIGH.
⛔ FORBIDDEN: Do NOT write placeholder text like "add validation here" — write the actual working corrected code.

### AFFECTED_FILES rule:
List real source file paths from the CONTEXT that this code belongs to or affects. Do NOT leave blank.

### Output (fill every tag — no skipping, no placeholders):
<IMPACT_ANALYSIS>
<RISK_LEVEL>SAFE | LOW | MEDIUM | HIGH</RISK_LEVEL>
<AFFECTED_FILES>comma-separated real file paths</AFFECTED_FILES>
<SYSTEM_IMPACT>How deploying this code as-is affects the overall system</SYSTEM_IMPACT>
<TECHNICAL_IMPACT>Backend or code-level risks and breakages</TECHNICAL_IMPACT>
<USER_IMPACT>What the end-user experiences as a result of this code</USER_IMPACT>
<SUGGESTION>The single most important recommended action in one sentence</SUGGESTION>
<ORIGINAL_CODE>
[exact submitted code — do not modify a single character]
</ORIGINAL_CODE>
<SAFE_CODE>
[fully working corrected code that resolves the identified risk — not a copy of the original]
</SAFE_CODE>
</IMPACT_ANALYSIS>"""

            if is_audit:
                enhanced_prompt = (
                    f"USER REQUEST (AUDIT MODE):\n{question}\n\n"
                    f"REMINDER: Your <SAFE_CODE> MUST contain the actual corrected, working code that fixes "
                    f"whatever issue you assign in <RISK_LEVEL>. Do not repeat the original code unchanged. "
                    f"Output ONLY the <IMPACT_ANALYSIS> XML block — start immediately with <IMPACT_ANALYSIS>."
                )
            else:
                enhanced_prompt = f"USER REQUEST (CHAT MODE):\n{question}\n\n[INSTRUCTION: Provide a technical Markdown explanation. No XML output.]"

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_instruction),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{enhanced_prompt}")
            ])

            chain = prompt | self.llm | StrOutputParser()

            def stream_generator():
                full_response = ""
                # We pass 'context' into the chain here
                for chunk in chain.stream({
                    "repo_name": repo_name,
                    "context": context,
                    "history": history,
                    "enhanced_prompt": enhanced_prompt
                }):
                    full_response += chunk
                    yield chunk

                history.append(HumanMessage(content=question))
                history.append(AIMessage(content=full_response))

            return stream_generator()

        except Exception as e:
            # FIX 3: Capture error as a string to avoid NameError: 'e' is not associated with a value
            error_msg = str(e)
            def error_stream(msg=error_msg):
                yield f"⚠️ AURA Error: {msg}"
            return error_stream()
