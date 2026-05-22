from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from trac2 import get_ricezioni, get_vettori
import os, json, base64, shutil
from datetime import datetime
from typing import Optional

app = FastAPI(title="Dashboard MM Operations Tracking", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DIRECTORY ---
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

# DATA_DIR: usa C:\ProgramData\MMTracking — sempre scrivibile senza admin
# Questo risolve l'errore di scrittura quando il server gira come utente standard
DATA_DIR = os.path.join(os.environ.get("PROGRAMDATA", "C:\\ProgramData"), "MMTracking")
os.makedirs(DATA_DIR, exist_ok=True)

SITES_FILE = os.path.join(DATA_DIR, "sites.json")
COMM_FILE  = os.path.join(DATA_DIR, "comunicazioni.json")

# Migrazione automatica: copia sites.json dall'app a ProgramData se non esiste
_default_sites = os.path.join(BASE_DIR, "sites.json")
if not os.path.exists(SITES_FILE) and os.path.exists(_default_sites):
    shutil.copy2(_default_sites, SITES_FILE)
    print(f"[INFO] sites.json migrato -> {SITES_FILE}")

# --- GESTIONE SITI ---
def load_sites():
    if os.path.exists(SITES_FILE):
        with open(SITES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    # fallback al file originale nell'app
    with open(_default_sites, "r", encoding="utf-8") as f:
        return json.load(f)

def save_sites(data):
    with open(SITES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.get("/api/sites")
def get_sites():
    cfg = load_sites()
    active = cfg.get("active", "liscate")
    sites  = cfg.get("sites", {})
    return {
        "active": active,
        "active_name": sites.get(active, {}).get("name", active.upper()),
        "active_color": sites.get(active, {}).get("color", "#3b82f6"),
        "sites": [{"key": k, "name": v["name"], "color": v["color"]} for k, v in sites.items()]
    }

@app.post("/api/sites/switch/{site_key}")
def switch_site(site_key: str):
    cfg = load_sites()
    if site_key not in cfg["sites"]:
        return {"error": f"Sito '{site_key}' non trovato"}
    cfg["active"] = site_key
    save_sites(cfg)
    return {"status": "ok", "active": site_key, "name": cfg["sites"][site_key]["name"]}

# --- COMUNICAZIONI ---
def load_comms():
    if os.path.exists(COMM_FILE):
        with open(COMM_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_comms(data):
    with open(COMM_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.get("/api/comunicazioni")
def get_comunicazioni():
    comms = load_comms()
    today = datetime.now().strftime("%Y-%m-%d")
    active = [c for c in comms if not c.get("expiry") or c["expiry"] >= today]
    if len(active) != len(comms):
        save_comms(active)
    return active

@app.post("/api/comunicazioni")
async def create_comunicazione(
    title:    str = Form(...),
    message:  str = Form(...),
    name:     str = Form(...),
    role:     str = Form(""),
    priority: str = Form("info"),
    expiry:   str = Form(""),
    image:    Optional[UploadFile] = File(None)
):
    comms = load_comms()
    image_data = None
    if image and image.filename:
        content = await image.read()
        image_data = f"data:{image.content_type};base64,{base64.b64encode(content).decode()}"

    new_comm = {
        "id":         int(datetime.now().timestamp() * 1000),
        "title":      title,
        "message":    message,
        "name":       name,
        "role":       role,
        "priority":   priority,
        "expiry":     expiry if expiry else None,
        "image":      image_data,
        "created_at": datetime.now().strftime("%d/%m/%Y %H:%M")
    }
    comms.insert(0, new_comm)
    save_comms(comms)
    return new_comm

@app.delete("/api/comunicazioni/{comm_id}")
def delete_comunicazione(comm_id: int):
    comms = load_comms()
    comms = [c for c in comms if c["id"] != comm_id]
    save_comms(comms)
    return {"status": "deleted"}

# --- DATI DASHBOARD ---
@app.get("/api/logistica/ricezioni")
def ricezioni():
    try:
        res = get_ricezioni()
        return res.get("dati", [])
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/logistica/dati")
def get_dati_completi():
    try:
        res  = get_ricezioni()
        dati = res.get("dati", [])
        return {
            "stato":  res.get("stato"),
            "errore": res.get("errore"),
            "kpis": {
                "colli_chiusi_tot":    sum(r.get("colli_chiusi", 0)      for r in dati),
                "pezzi_chiusi_tot":    sum(r.get("pezzi_chiusi", 0)      for r in dati),
                "ordini_chiusi_tot":   sum(r.get("nr_order_chiusi", 0)   for r in dati),
                "colli_spediti_tot":   sum(r.get("colli_spedito", 0)     for r in dati),
                "pezzi_spediti_tot":   sum(r.get("pezzi_spedito", 0)     for r in dati),
                "ordini_spediti_tot":  sum(r.get("nr_order_spedito", 0)  for r in dati),
                "colli_partenza_tot":  sum(r.get("colli_partenza", 0)    for r in dati),
                "pezzi_partenza_tot":  sum(r.get("pezzi_partenza", 0)    for r in dati),
                "ordini_partenza_tot": sum(r.get("nr_order_partenza", 0) for r in dati),
                "clienti_totali":      len(set(r.get("tkinde") for r in dati if r.get("tkinde")))
            },
            "dati_dettaglio": dati
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/logistica/vettori")
def get_dati_vettori():
    try:
        return get_vettori()
    except Exception as e:
        return {"stato": "error", "dati": [], "errore": str(e)}

# --- FRONTEND STATICO ---
@app.get("/")
def home():
    return FileResponse(os.path.join(static_dir, "index.html"))

app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    print(f"[INFO] Avvio server... DATA_DIR={DATA_DIR}")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
