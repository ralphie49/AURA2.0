import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

class Neo4jManager:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USERNAME", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD")
        self.driver = None

    def connect(self):
        try:
            # The authentication happens here
            self.driver = GraphDatabase.driver(
                self.uri, 
                auth=(self.user, self.password)
            )
            # This line tests if the password is correct immediately
            self.driver.verify_connectivity()
            print(f"🟢 SUCCESS: Connected to Neo4j at {self.uri}")
        except Exception as e:
            print(f"🔴 AUTH ERROR: Check your password in .env. \nDetails: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def save_data(self, label, properties):
        """Example method to save data to your new PWAI project"""
        if not self.driver:
            print("❌ No active connection.")
            return

        query = f"MERGE (n:{label} {{id: $id}}) SET n += $props RETURN n"
        with self.driver.session() as session:
            session.run(query, id=properties.get('id'), props=properties)
            print(f"✅ Data saved to node: {label}")

# --- Test Execution ---
if __name__ == "__main__":
    db = Neo4jManager()
    db.connect()
    if db.driver:
        # Test saving a node for your PWAI project
        db.save_data("Project", {"id": "PWAI_01", "status": "Initializing"})
        db.close()