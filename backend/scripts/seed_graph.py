import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from app.graph.supplier_graph_service import (
    create_global_entity_node,
    link_supplier_to_entity,
    create_entity_relationship
)

def seed_graph():
    try:
        df = pd.read_csv("data/supplier_dataset_750.csv")
    except Exception as e:
        print(f"Failed to read CSV: {e}")
        return

    print("Seeding Neo4j graph relationships...")
    count = 0
    edges_created = 0
    
    for _, row in df.iterrows():
        supplier_name = row["name"]
        parent_company = row["parent_company"]
        country = row["country"]
        
        canonical_name = supplier_name
        
        # 1. Ensure global entity node
        create_global_entity_node(
            canonical_name=canonical_name,
            entity_type="COMPANY",
            country=country
        )
        
        # 2. Link Supplier -> Entity
        link_supplier_to_entity(
            supplier_name=supplier_name,
            canonical_name=canonical_name,
            confidence_score=1.0,
            resolution_method="SEED"
        )
        
        # 3. Create relationship if parent exists
        if pd.notna(parent_company) and str(parent_company).strip():
            parent_name = str(parent_company).strip()
            # Ensure parent node exists
            create_global_entity_node(
                canonical_name=parent_name,
                entity_type="COMPANY",
                country="Global"
            )
            # Create SUBSIDIARY_OF relation
            create_entity_relationship(
                subject_entity=canonical_name,
                object_entity=parent_name,
                relationship_type="SUBSIDIARY_OF",
                confidence=0.9
            )
            edges_created += 1
            
        count += 1
        if count % 100 == 0:
            print(f"Processed {count} rows...")
            
    print(f"Graph seeding complete. Processed {count} suppliers, created {edges_created} relationships.")

if __name__ == "__main__":
    seed_graph()
