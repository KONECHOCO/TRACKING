import pyodbc
import random
import datetime

# Cache globale per mantenere coerenti i dati simulati
_simulated_data = None
_last_simulation_update = datetime.datetime.now()

# 🔌 Tentativo di connessione al DB2 su AS/400 con fallback su più driver
def get_connection():
    drivers = [
        "iSeries Access ODBC Driver",
        "IBM i Access ODBC Driver",
        "IBM DB2 ODBC DRIVER - IBMDBCL1",
        "Client Access ODBC Driver (32-bit)"
    ]
    
    last_err = None
    for drv in drivers:
        try:
            conn_str = f"DRIVER={{{drv}}};SYSTEM=192.168.150.12;UID=KONEIN1;PWD=KONEI;"
            
            if "IBM DB2" in drv:
                conn_str = f"DRIVER={{{drv}}};DATABASE=IL_TUO_DB;HOSTNAME=192.168.150.12;PORT=50000;PROTOCOL=TCPIP;UID=KONEIN1;PWD=KONEI;"
            
            cnx = pyodbc.connect(conn_str, timeout=3)
            print(f"[INFO] Connessione DB2 riuscita con il driver: {drv}")
            return cnx
        except Exception as e:
            last_err = e
            print(f"[WARN] Tentativo fallito con il driver {drv}: {str(e)[:100]}...")
            continue
            
    raise last_err if last_err else Exception("Impossibile connettersi ad AS/400 con i driver disponibili.")


# 📦 Generatore di dati simulati (mock data) coerenti con le nuove metriche di Outbound
def generate_initial_mock_data():
    clients = [
        ("D14", "LEGAMI TEST"),
        ("D19", "SVR  TEST"),
        ("D16", "COOP ITALIA SRL"),
        ("D17", "BARILLA G. E R. FRATELLI"),
        ("D18", "DECO INDUSTRIE"),
        ("D19", "CHIESI FARMACEUTICI"),
        ("D20", "DIFARCO DISTRIBUZIONE"),
        ("D21", "KASANOVA SPA"),
        ("D22", "L'OREAL ITALIA SPA"),
        ("D23", "FERRERO COMMERCIALE")
    ]
    
    data = []
    
    for tkinde, mddesc in clients:
        # Generiamo numeri coerenti per ciascun cliente
        nr_order_chiusi = random.randint(2, 25)
        colli_chiusi = nr_order_chiusi * random.randint(3, 12)
        pezzi_chiusi = colli_chiusi * random.randint(8, 20)
        
        # Gli spediti oggi non possono superare i chiusi oggi + vecchi in giacenza
        # Per semplicità, facciamo in modo che una parte dei chiusi oggi sia già spedita
        nr_order_spedito = max(0, nr_order_chiusi - random.randint(0, 5))
        colli_spedito = max(0, colli_chiusi - random.randint(0, colli_chiusi // 3))
        pezzi_spedito = max(0, pezzi_chiusi - random.randint(0, pezzi_chiusi // 3))
        
        # Giacenza in partenza (allestito ultimi 5 giorni ma non spedito)
        nr_order_partenza = random.randint(1, 10)
        colli_partenza = nr_order_partenza * random.randint(3, 10)
        pezzi_partenza = colli_partenza * random.randint(8, 18)
        
        data.append({
            "tkinde": tkinde,
            "mddesc": mddesc,
            "colli_chiusi": colli_chiusi,
            "pezzi_chiusi": pezzi_chiusi,
            "nr_order_chiusi": nr_order_chiusi,
            "colli_spedito": colli_spedito,
            "pezzi_spedito": pezzi_spedito,
            "nr_order_spedito": nr_order_spedito,
            "colli_partenza": colli_partenza,
            "pezzi_partenza": pezzi_partenza,
            "nr_order_partenza": nr_order_partenza
        })
        
    return data


# ⚡ Aggiorna i dati simulati in tempo reale (simula allestimenti e spedizioni)
def update_mock_data(data):
    # Seleziona un cliente a caso
    idx = random.randint(0, len(data) - 1)
    client = data[idx]
    
    action = random.choice(["close_order", "ship_order", "none"])
    
    if action == "close_order":
        # Chiudiamo un nuovo ordine per il cliente
        colli = random.randint(3, 10)
        pezzi = colli * random.randint(8, 15)
        
        client["nr_order_chiusi"] += 1
        client["colli_chiusi"] += colli
        client["pezzi_chiusi"] += pezzi
        
        # L'ordine va anche in giacenza partenza in attesa di spedizione
        client["nr_order_partenza"] += 1
        client["colli_partenza"] += colli
        client["pezzi_partenza"] += pezzi
        
    elif action == "ship_order":
        # Spediamo un ordine in giacenza
        if client["nr_order_partenza"] > 0:
            # Calcoliamo quanti colli spedire tra quelli in partenza
            orders_to_ship = 1
            colli_to_ship = min(client["colli_partenza"], random.randint(3, 8))
            pezzi_to_ship = min(client["pezzi_partenza"], colli_to_ship * random.randint(8, 12))
            
            # Incrementiamo lo spedito oggi
            client["nr_order_spedito"] += orders_to_ship
            client["colli_spedito"] += colli_to_ship
            client["pezzi_spedito"] += pezzi_to_ship
            
            # Riduciamo la giacenza in partenza
            client["nr_order_partenza"] = max(0, client["nr_order_partenza"] - orders_to_ship)
            client["colli_partenza"] = max(0, client["colli_partenza"] - colli_to_ship)
            client["pezzi_partenza"] = max(0, client["pezzi_partenza"] - pezzi_to_ship)
            
    return data


# 📦 Funzione principale per estrarre i dati
def get_ricezioni(priorita=None):
    global _simulated_data, _last_simulation_update
    
    try:
        # Tenta la connessione reale su AS/400
        cnx = get_connection()
        cur = cnx.cursor()
        
        # NUOVA QUERY RICHIESTA (Outbound Order Fulfillment)
        sql = """
        WITH TRACK AS (
            SELECT TKINDE, MDDESC, SUM(TKCOLL) AS COLLI_CHIUSI, 
            SUM(TKPEZZ) AS PEZZI_CHIUSI, 
            COUNT(TKNUPB) AS NR_ORDER_CHIUSI     
            FROM CDFILE.TRACK13L LEFT JOIN CONTROL.MANDA01L
            ON TKINDE = MDCODI 
            WHERE TKDABA = varchar_format(current_date, 'YYYYMMDD') 
            GROUP BY TKINDE, MDDESC
        ),
        SPEDITO AS (
            SELECT TKINDE, MDDESC, SUM(TKCOLL) AS COLLI_SPEDITO, 
            SUM(TKPEZZ) AS PEZZI_SPEDITO, 
            COUNT(TKNUPB) AS NR_ORDER_SPEDITO     
            FROM CDFILE.TRACK13L LEFT JOIN CONTROL.MANDA01L
            ON TKINDE = MDCODI 
            WHERE TKDTPA = varchar_format(current_date, 'YYYYMMDD') 
            GROUP BY TKINDE, MDDESC 
        ),
        PARTENZA AS (
            SELECT TKINDE, MDDESC, SUM(TKCOLL) AS COLLI_PARTENZA, 
            SUM(TKPEZZ) AS PEZZI_PARTENZA, 
            COUNT(TKNUPB) AS NR_ORDER_PARTENZA     
            FROM CDFILE.TRACK13L LEFT JOIN CONTROL.MANDA01L
            ON TKINDE = MDCODI 
            WHERE TKDABA > varchar_format(current_date - 5 DAYS, 'YYYYMMDD') 
            AND TKFL22 <> ' ' AND TKDTPA = 0 
            GROUP BY TKINDE, MDDESC
        )
        SELECT A.TKINDE, A.MDDESC, COLLI_CHIUSI,  
        PEZZI_CHIUSI, NR_ORDER_CHIUSI,
        COLLI_SPEDITO,  PEZZI_SPEDITO,  NR_ORDER_SPEDITO,
        COLLI_PARTENZA,  PEZZI_PARTENZA,  NR_ORDER_PARTENZA   
        FROM TRACK A LEFT JOIN SPEDITO B
        ON A.TKINDE = B.TKINDE AND A.MDDESC = B.MDDESC
        LEFT JOIN PARTENZA C
        ON A.TKINDE = C.TKINDE AND A.MDDESC = C.MDDESC
        ORDER BY COLLI_CHIUSI DESC
        """
        
        print("[INFO] Esecuzione SQL su AS/400...")
        cur.execute(sql)
        rows = cur.fetchall()
        
        result = []
        for r in rows:
            result.append({
                "tkinde": r.TKINDE,
                "mddesc": r.MDDESC,
                "colli_chiusi": int(r.COLLI_CHIUSI) if r.COLLI_CHIUSI is not None else 0,
                "pezzi_chiusi": int(r.PEZZI_CHIUSI) if r.PEZZI_CHIUSI is not None else 0,
                "nr_order_chiusi": int(r.NR_ORDER_CHIUSI) if r.NR_ORDER_CHIUSI is not None else 0,
                "colli_spedito": int(r.COLLI_SPEDITO) if r.COLLI_SPEDITO is not None else 0,
                "pezzi_spedito": int(r.PEZZI_SPEDITO) if r.PEZZI_SPEDITO is not None else 0,
                "nr_order_spedito": int(r.NR_ORDER_SPEDITO) if r.NR_ORDER_SPEDITO is not None else 0,
                "colli_partenza": int(r.COLLI_PARTENZA) if r.COLLI_PARTENZA is not None else 0,
                "pezzi_partenza": int(r.PEZZI_PARTENZA) if r.PEZZI_PARTENZA is not None else 0,
                "nr_order_partenza": int(r.NR_ORDER_PARTENZA) if r.NR_ORDER_PARTENZA is not None else 0
            })
            
        cur.close()
        cnx.close()
        
        return {
            "stato": "connected",
            "dati": result
        }
        
    except Exception as e:
        print(f"[WARN] Connessione ad AS/400 fallita. Avvio MODALITA SIMULATA. Errore: {e}")
        
        if _simulated_data is None:
            _simulated_data = generate_initial_mock_data()
        
        now = datetime.datetime.now()
        if (now - _last_simulation_update).total_seconds() > 5:
            _simulated_data = update_mock_data(_simulated_data)
            _last_simulation_update = now
            
        return {
            "stato": "simulated",
            "dati": _simulated_data,
            "errore": str(e)
        }