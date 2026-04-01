# Project Manage Myself

'Project Manage Myself' is a small local-only project management board for personal projects. Define projects, add milestones, and track them on a visual Kanban-style board.

## Features

- Create projects with name, description, and a color “mood”
- Add milestones with status (Backlog / In Progress / Done) and optional due date
- Drag milestones between columns to update status
- Visual progress bar per project
- Light/dark theme toggle
- Data stored in a local JSON file (`data/pmm.json`)

## Requirements

- Python 3.10+ (recommended)
- Pip

## Setup (Windows / local)

1. Open a terminal in the project folder:

   ```bash
   cd "c:\\Users\\useth\\Muh_Projects\\Project-Manage-Myself"
   ```

2. (Optional but recommended) Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Run the Flask app:

   ```bash
   python app.py
   ```

5. Open your browser and visit:

   - `http://127.0.0.1:5000/`

On first run, the app will create a `data` folder and `pmm.json` file automatically.

## Data location

- All project and milestone data is stored in:

  - `data/pmm.json`

If you ever want to reset, stop the app, delete this file (or the whole `data` folder), and start the app again.

## Future ideas

- Tags and priority for milestones
- Analytics / charts for project progress
- User accounts and cloud deployment

