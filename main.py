from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from trac2 import get_ricezioni
import os
from collections import defaultdict

app = FastAPI(title="Dashboard MM Operations Tracking", version="1.0.0")

# Abilitazione CORS per consentire chiamate da altre porte/host
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Assicuriamoci che la cartella 'static' esista
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

# --- Endpoint API legacy per compatibilità Streamlit ---

@app.get("/api/logistica/ricezioni")
def ricezioni():
    try:
        res = get_ricezioni()
        return res.get("dati", [])
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/logistica/kpi")
def get_kpis():
    try:
        res = get_ricezioni()
        dati = res.get("dati", [])
        return {
            "colli_chiusi": sum(r.get("colli_chiusi", 0) for r in dati),
            "colli_spediti": sum(r.get("colli_spedito", 0) for r in dati),
            "colli_partenza": sum(r.get("colli_partenza", 0) for r in dati)
        }
    except Exception as e:
        return {"error": str(e)}

# --- Nuovi Endpoint Unificati per Dashboard High-Fidelity ---

@app.get("/api/logistica/dati")
def get_dati_completi():
    try:
        res = get_ricezioni()
        dati = res.get("dati", [])
        
        # Calcolo KPI aggregati al volo
        colli_chiusi_tot = sum(r.get("colli_chiusi", 0) for r in dati)
        pezzi_chiusi_tot = sum(r.get("pezzi_chiusi", 0) for r in dati)
        ordini_chiusi_tot = sum(r.get("nr_order_chiusi", 0) for r in dati)
        
        colli_spediti_tot = sum(r.get("colli_spedito", 0) for r in dati)
        pezzi_spediti_tot = sum(r.get("pezzi_spedito", 0) for r in dati)
        ordini_spediti_tot = sum(r.get("nr_order_spedito", 0) for r in dati)
        
        colli_partenza_tot = sum(r.get("colli_partenza", 0) for r in dati)
        pezzi_partenza_tot = sum(r.get("pezzi_partenza", 0) for r in dati)
        ordini_partenza_tot = sum(r.get("nr_order_partenza", 0) for r in dati)
        
        clienti_unici = len(set(r.get("tkinde") for r in dati if r.get("tkinde")))
        
        return {
            "stato": res.get("stato"),
            "errore": res.get("errore"),
            "kpis": {
                "colli_chiusi_tot": colli_chiusi_tot,
                "pezzi_chiusi_tot": pezzi_chiusi_tot,
                "ordini_chiusi_tot": ordini_chiusi_tot,
                "colli_spediti_tot": colli_spediti_tot,
                "pezzi_spediti_tot": pezzi_spediti_tot,
                "ordini_spediti_tot": ordini_spediti_tot,
                "colli_partenza_tot": colli_partenza_tot,
                "pezzi_partenza_tot": pezzi_partenza_tot,
                "ordini_partenza_tot": ordini_partenza_tot,
                "clienti_totali": clienti_unici
            },
            "dati_dettaglio": dati
        }
    except Exception as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}

# --- Servizio Frontend Statico ---

# Serviamo la pagina principale alla root dell'applicazione
@app.get("/")
def home():
    return FileResponse(os.path.join(static_dir, "index.html"))

# Montiamo la directory static per servire CSS e JS
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    # Avviamo il server su localhost porta 8080
    print("[INFO] Avvio server Dashboard Logistica...")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)