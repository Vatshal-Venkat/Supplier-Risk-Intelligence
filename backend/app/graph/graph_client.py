from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable
import os

# =====================================================
# ENV CONFIGURATION
# =====================================================

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# =====================================================
# DRIVER INITIALIZATION
# =====================================================

driver = None


def init_driver():
    global driver

    if driver is None:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
        )

        # Optional: verify connectivity at startup
        try:
            driver.verify_connectivity()
            print("✅ Neo4j connection established.")
        except ServiceUnavailable as e:
            print("❌ Neo4j connection failed:", e)
            driver = None


# Initialize on import
init_driver()


# =====================================================
# SESSION HELPER
# =====================================================

def get_session():
    if driver is None:
        raise RuntimeError("Neo4j driver is not initialized.")

    return driver.session()


# =====================================================
# CLEAN SHUTDOWN (Optional but Recommended)
# =====================================================

def close_driver():
    global driver
    if driver:
        driver.close()
        driver = None
