import streamlit as st
import requests
import pandas as pd

# 🔗 URL del tuo backend FastAPI
API_URL = "http://127.0.0.1:8080"

# ⚙️ Configurazione pagina
st.set_page_config(page_title="Dashboard MM Operations Tracking", layout="wide")

st.title("📦 Dashboard MM Operations Tracking")

# --- KPI principali ---
st.header("KPI principali")

try:
    kpi = requests.get(f"{API_URL}/api/logistica/kpi", timeout=5).json()
    col1, col2, col3 = st.columns(3)
    col1.metric("Colli totali", kpi.get("colli_totali", 0))
    col2.metric("Pezzi totali", kpi.get("pezzi_totali", 0))
    col3.metric("Righe totali", kpi.get("righe_totali", 0))
except Exception as e:
    st.error(f"❌ Errore nel caricamento dei KPI: {e}")

# --- Trend giornaliero ---
st.header("Trend giornaliero")

try:
    giorno = requests.get(f"{API_URL}/api/logistica/giorno", timeout=5).json()
    if isinstance(giorno, list) and len(giorno) > 0:
        df_giorno = pd.DataFrame(giorno)
        st.line_chart(df_giorno.set_index("data_bolla")[["colli", "pezzi"]])
    else:
        st.warning("⚠️ Nessun dato disponibile per il trend giornaliero.")
except Exception as e:
    st.error(f"❌ Errore nel caricamento del trend giornaliero: {e}")

# --- Colli per categoria ---
st.header("Colli per categoria")

try:
    categoria = requests.get(f"{API_URL}/api/logistica/categoria", timeout=5).json()
    if isinstance(categoria, list) and len(categoria) > 0:
        df_cat = pd.DataFrame(categoria)
        st.bar_chart(df_cat.set_index("categoria")["colli"])
    else:
        st.warning("⚠️ Nessun dato disponibile per categoria.")
except Exception as e:
    st.error(f"❌ Errore nel caricamento delle categorie: {e}")

# --- Colli per missione ---
st.header("Colli per missione")

try:
    missione = requests.get(f"{API_URL}/api/logistica/missione", timeout=5).json()
    if isinstance(missione, list) and len(missione) > 0:
        df_mis = pd.DataFrame(missione)
        st.bar_chart(df_mis.set_index("missione")["colli"])
    else:
        st.warning("⚠️ Nessun dato disponibile per missione.")
except Exception as e:
    st.error(f"❌ Errore nel caricamento delle missioni: {e}")

# --- Colli per priorità ---
st.header("Colli per priorità")

try:
    priorita = requests.get(f"{API_URL}/api/logistica/priorita", timeout=5).json()
    if isinstance(priorita, list) and len(priorita) > 0:
        df_pri = pd.DataFrame(priorita)
        st.bar_chart(df_pri.set_index("priorita")["colli"])
    else:
        st.warning("⚠️ Nessun dato disponibile per priorità.")
except Exception as e:
    st.error(f"❌ Errore nel caricamento delle priorità: {e}")

# --- Dettaglio ricezioni ---
st.header("Dettaglio ricezioni")

try:
    priorita_sel = st.selectbox("Filtra per priorità", ["", "H", "M", "L"])
    if priorita_sel:
        dati = requests.get(f"{API_URL}/api/logistica/ricezioni?priorita={priorita_sel}", timeout=5).json()
    else:
        dati = requests.get(f"{API_URL}/api/logistica/ricezioni", timeout=5).json()

    if isinstance(dati, list) and len(dati) > 0:
        df = pd.DataFrame(dati)
        st.dataframe(df, use_container_width=True)
    else:
        st.warning("⚠️ Nessun dato disponibile per le ricezioni.")
except Exception as e:
    st.error(f"❌ Errore nel caricamento delle ricezioni: {e}")