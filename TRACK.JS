const ibmdb = require("ibm_db");
const express = require('express');
const app = express();

// Stringa di connessione al tuo AS400
const connStr = "DATABASE=IL_TUO_DB;HOSTNAME=indirizzo_ip_as400;PORT=50000;PROTOCOL=TCPIP;UID=utente;PWD=password;";

app.get('/api/dati-logistica', (req, res) => {
    ibmdb.open(connStr, function (err, conn) {
        if (err) return res.status(500).json({ error: err.message });

        // Inseriamo esattamente la TUA query SQL
        const query = `
            SELECT otmand as mandante, otmaga as magazzino, tkrag1 as ragione, 
                   otrfma as missione, otcatc as categoria, otprio as priorita, 
                   tkcoll as colli, tkpezz as pezzi, T2rigv as righe, tkdaba as data_bolla
            FROM cdfile.ordts16l 
            LEFT JOIN cdfile.track13l ON otmand = tkinde AND otmaga = tkmaga AND otorsp = tkorsp
            LEFT JOIN cdfile.TRAC201L ON otmand = t2inde AND otorsp = t2orsp
            WHERE otmand = 'D14' AND otmaga = 'PV' 
              AND tkdaba between 20250101 AND 20251231 
              AND otstat = '7' AND UPPER(otutim) = 'RICEZIONE' AND upper(otgara) <> 'ANNULLATO'
            ORDER BY tkdaba
        `;

        conn.query(query, function (err, data) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                // Il driver ibm_db restituisce direttamente un array JSON!
                res.json(data); 
            }
            conn.close();
        });
    });
});

app.listen(3000, () => console.log('API AS400 in ascolto sulla porta 3000'));