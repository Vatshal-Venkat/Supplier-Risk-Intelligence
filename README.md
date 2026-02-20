# Supplier Risk Intelligence Platform

A full-stack Supplier Risk Intelligence system designed to evaluate,
score, and visualize supplier risk exposure using relational and
graph-based analysis.

------------------------------------------------------------------------

## Overview

This platform allows organizations to:

-   Create and manage suppliers
-   Perform risk assessments
-   Check sanctions exposure
-   Evaluate Section 889 compliance
-   Detect external intelligence signals
-   Propagate indirect risk via graph relationships
-   Visualize entity connections
-   Generate risk analytics dashboards

------------------------------------------------------------------------

## Architecture

Frontend: 
- Next.js (App Router, TypeScript) 
- Tailwind CSS
- Cytoscape& Force Graph (Graph visualization)
- Recharts (Analytics dashboards)
- Axios (API communication)

Backend: 
- FastAPI
- SQLAlchemy ORM
- Alembic (Migrations)
- PostgreSQL (Relational DB)
- Neo4j (Graph DB)
- JWT Authentication
- RapidFuzz (Sanction name matching)
- APScheduler (Scheduled jobs)

------------------------------------------------------------------------

## Project Structure

Supplier-Risk-Intelligence/
│

├── backend/

│ ├── app/

│ ├── alembic/

│ ├── requirements.txt

│

├── frontend/

│ ├── app/

│ ├── components/

│ ├── package.json

│

└── README.md

------------------------------------------------------------------------

## Backend Setup

1.  Navigate to Backend
```bash
cd backend
```
2.  Create Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate

Mac/Linux: python3 -m venv venv source venv/bin/activate
```
3.  Install Dependencies
```
pip install -r requirements.txt
```
4.  Configure Environment Variables

Create a `.env` file inside `backend/`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/supplierdb
SECRET_KEY=your_secret_key NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j NEO4J_PASSWORD=password
```
5.  Run Migrations
```
alembic upgrade head
```
6.  Start Backend Server
```
uvicorn app.main:app --reload

API Docs: http://localhost:8000/docs
```
------------------------------------------------------------------------

## Database Requirements

You must install:

-   PostgreSQL
-   Neo4j (Desktop or Aura)

Ensure both services are running before starting the backend.

------------------------------------------------------------------------

## Frontend Setup

1.  Navigate to Frontend
```
cd frontend
```
2.  Install Dependencies
```
npm install
```
3.  Run Development Server
```
npm run dev
```
Frontend: http://localhost:3000

Ensure backend is running on port 8000.

------------------------------------------------------------------------

## Authentication Flow

-   User login
-   Password verification using bcrypt
-   JWT token generation
-   Token validation on protected routes

------------------------------------------------------------------------

## Risk Evaluation Engine

Risk is calculated based on:

-   Direct sanctions match
-   Section 889 exposure
-   External intelligence signals
-   Graph-based indirect exposure propagation

Neo4j is used for multi-hop relationship analysis.

------------------------------------------------------------------------

------------------------------------------------------------------------

## License

This project is for educational and demonstration purposes.
