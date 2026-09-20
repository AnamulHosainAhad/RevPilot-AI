const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();

app.use(express.json());
app.use(express.static("."));

app.use(session({
    secret: "revpilot-secret",
    resave: false,
    saveUninitialized: false
}));


// ==================== DATABASE ====================

const db = new Database("revpilot.db");


// Businesses table
db.prepare(`
    CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
`).run();


// Leads table
db.prepare(`
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        business TEXT,
        message TEXT,
        reply TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// ==================== FOLLOW-UP COLUMNS ====================

try {
    db.prepare(
        "ALTER TABLE leads ADD COLUMN followup_message TEXT"
    ).run();
} catch (error) {
    // Column already exists
}


try {
    db.prepare(
        "ALTER TABLE leads ADD COLUMN followup_date TEXT"
    ).run();
} catch (error) {
    // Column already exists
}


try {
    db.prepare(
        "ALTER TABLE leads ADD COLUMN followup_sent INTEGER DEFAULT 0"
    ).run();
} catch (error) {
    // Column already exists
}

// ==================== REVENUE COLUMNS ====================

try {
    db.prepare(
        "ALTER TABLE leads ADD COLUMN converted INTEGER DEFAULT 0"
    ).run();
} catch (error) {
    // Column already exists
}

try {
    db.prepare("ALTER TABLE leads ADD COLUMN lead_score INTEGER DEFAULT 0").run();
} catch (error) {}

try {
    db.prepare("ALTER TABLE leads ADD COLUMN buying_intent TEXT DEFAULT 'Low'").run();
} catch (error) {}

try {
    db.prepare("ALTER TABLE leads ADD COLUMN ai_reason TEXT").run();
} catch (error) {}

try {
    db.prepare(
        "ALTER TABLE leads ADD COLUMN revenue REAL DEFAULT 0"
    ).run();
} catch (error) {
    // Column already exists
}


// ==================== OPENAI ====================

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ==================== SIGNUP ====================

app.post("/signup", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "All fields are required"
            });
        }

        const existing = db.prepare(`
            SELECT * FROM businesses
            WHERE email = ?
        `).get(email);

        if (existing) {
            return res.status(400).json({
                error: "Email already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO businesses
            (name, email, password)
            VALUES (?, ?, ?)
        `).run(
            name,
            email,
            hashedPassword
        );

        req.session.businessId =
            result.lastInsertRowid;

        req.session.businessName =
            name;

        res.json({
            message: "Signup successful"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Signup failed"
        });
    }
});


// ==================== LOGIN ====================

app.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const business = db.prepare(`
            SELECT * FROM businesses
            WHERE email = ?
        `).get(email);

        if (!business) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const match =
            await bcrypt.compare(
                password,
                business.password
            );

        if (!match) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        req.session.businessId =
            business.id;

        req.session.businessName =
            business.name;

        res.json({
            message: "Login successful",
            business: business.name
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Login failed"
        });
    }
});


// ==================== LOGOUT ====================

app.post("/logout", (req, res) => {

    req.session.destroy();

    res.json({
        message: "Logged out"
    });
});


// ==================== CURRENT USER ====================

app.get("/me", (req, res) => {

    if (!req.session.businessId) {

        return res.json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        businessId: req.session.businessId,
        businessName: req.session.businessName
    });
});


// ==================== AI GENERATE ====================

app.post("/generate", async (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }

        const { business, message } = req.body;

        const response =
            await client.responses.create({

                model: "gpt-5.6-luna",

                instructions: `
You are an AI sales assistant.

Analyze the customer message.

Return exactly this format:

REPLY:
A short professional customer reply.

LEAD:
HOT, WARM, or COLD

INTENT:
What the customer wants.

FOLLOW_UP:
When the business should follow up.

Do not invent product information.
`,

                input:
                    "Business: " + business +
                    "\nCustomer message: " + message
            });

        res.json({
            reply: response.output_text
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "AI request failed"
        });
    }
});

// ==================== AI LEAD SCORING ====================

app.post("/score-lead", async (req, res) => {

    try {

        if (!req.session.businessId) {
            return res.status(401).json({
                error: "Please login first"
            });
        }

        const { business, message } = req.body;

        if (!business || !message) {
            return res.status(400).json({
                error: "Business and message are required"
            });
        }

        const response = await openai.responses.create({

            model: "gpt-4o-mini",

            input: `
You are an AI sales lead scoring assistant.

Business:
${business}

Customer message:
${message}

Analyze the customer's buying intent.

Return ONLY valid JSON:

{
    "score": 0,
    "intent": "High",
    "reason": "Short explanation",
    "followup": "Recommended follow-up action"
}

Rules:

Score 80-100 = High buying intent
Score 50-79 = Medium buying intent
Score 0-49 = Low buying intent

High intent:
- Asking price
- Asking how to order
- Asking delivery details
- Asking payment method
- Ready to buy
- Wants to confirm order

Medium intent:
- Interested but asking questions
- Comparing products
- Asking about features
- Asking availability

Low intent:
- General question
- Just browsing
- No clear buying signal

Keep reason short.
Keep followup practical.
`
        });

        const result = JSON.parse(response.output_text);

        res.json(result);

    } catch (error) {

        console.log("Lead scoring error:", error);

        res.status(500).json({
            error: "Could not score lead"
        });

    }

});


// ==================== SAVE LEAD ====================

app.post("/save-lead", (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }

        const {
            business,
            message,
            reply,
            status,
            leadScore,
            buyingIntent,
            aiReason
        } = req.body;


        const result = db.prepare(`
            INSERT INTO leads
            (
                business_id,
                business,
                message,
                reply,
                status,
                lead_score,
                buying_intent,
                ai_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.session.businessId,
            business,
            message,
            reply,
            status,
            Number(leadScore || 0),
            buyingIntent || "Low",
            aiReason || ""
        );


        res.json({
            message: "Lead saved successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not save lead"
        });
    }
});


// ==================== GET LEADS ====================

app.get("/leads", (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }


        const leads = db.prepare(`
            SELECT * FROM leads
            WHERE business_id = ?
            ORDER BY id DESC
        `).all(
            req.session.businessId
        );


        res.json(leads);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not load leads"
        });
    }
});

// ==================== GENERATE FOLLOW-UP ====================

app.post("/generate-followup", async (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }


        const {
            message,
            reply,
            status
        } = req.body;


        if (!message || !reply) {

            return res.status(400).json({
                error: "Message and reply are required"
            });
        }


        const response =
            await client.responses.create({

                model: "gpt-5.6-luna",

                instructions: `
You are a professional e-commerce sales follow-up assistant.

Write a short, friendly follow-up message
for a customer.

Do not sound pushy.

Do not invent product information.

Return only the follow-up message.
`,

                input:
                    "Customer message: " + message +
                    "\nPrevious AI reply: " + reply +
                    "\nLead status: " + status
            });


        res.json({
            followup: response.output_text
        });


    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not generate follow-up"
        });
    }
});

// ==================== SAVE FOLLOW-UP ====================

app.post("/save-followup", (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }


        const {
            leadId,
            followupMessage,
            followupDate
        } = req.body;


        const result = db.prepare(`
            UPDATE leads
            SET followup_message = ?,
                followup_date = ?,
                followup_sent = 0
            WHERE id = ?
            AND business_id = ?
        `).run(
            followupMessage,
            followupDate,
            leadId,
            req.session.businessId
        );


        if (result.changes == 0) {

            return res.status(404).json({
                error: "Lead not found"
            });
        }


        res.json({
            message: "Follow-up saved successfully"
        });


    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not save follow-up"
        });
    }
});

// ==================== DUE FOLLOW-UPS ====================

app.get("/due-followups", (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }

        const leads = db.prepare(`
            SELECT *
            FROM leads
            WHERE business_id = ?
            AND followup_date IS NOT NULL
            AND followup_date <= datetime('now', 'localtime')
            AND followup_sent = 0
            ORDER BY followup_date ASC
        `).all(req.session.businessId);

        res.json(leads);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not load due follow-ups"
        });
    }
});

// ==================== MARK FOLLOW-UP DONE ====================

app.post("/complete-followup", (req, res) => {

    try {

        if (!req.session.businessId) {

            return res.status(401).json({
                error: "Please login first"
            });
        }

        const { leadId } = req.body;

        const result = db.prepare(`
            UPDATE leads
            SET followup_sent = 1
            WHERE id = ?
            AND business_id = ?
        `).run(
            leadId,
            req.session.businessId
        );

        if (result.changes == 0) {

            return res.status(404).json({
                error: "Lead not found"
            });
        }

        res.json({
            message: "Follow-up marked as completed"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not complete follow-up"
        });
    }
});

// ==================== MARK AS CONVERTED ====================

app.post("/mark-converted", (req, res) => {
    try {

        if (!req.session.businessId) {
            return res.status(401).json({
                error: "Please login first"
            });
        }

        const { leadId, revenue } = req.body;

        if (!leadId || revenue === undefined) {
            return res.status(400).json({
                error: "Lead ID and revenue are required"
            });
        }

        const amount = Number(revenue);

        if (isNaN(amount) || amount < 0) {
            return res.status(400).json({
                error: "Invalid revenue amount"
            });
        }

        const result = db.prepare(`
            UPDATE leads
            SET converted = 1,
                revenue = ?
            WHERE id = ?
            AND business_id = ?
        `).run(
            amount,
            leadId,
            req.session.businessId
        );

        if (result.changes == 0) {
            return res.status(404).json({
                error: "Lead not found"
            });
        }

        res.json({
            message: "Lead marked as converted successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not mark lead as converted"
        });
    }
});

// ==================== EDIT LEAD ====================

app.post("/edit-lead", (req, res) => {
    try {

        if (!req.session.businessId) {
            return res.status(401).json({
                error: "Please login first"
            });
        }

        const {
            leadId,
            business,
            message,
            reply,
            status
        } = req.body;

        if (!leadId || !business || !message || !reply || !status) {
            return res.status(400).json({
                error: "All fields are required"
            });
        }

        const result = db.prepare(`
            UPDATE leads
            SET business = ?,
                message = ?,
                reply = ?,
                status = ?
            WHERE id = ?
            AND business_id = ?
        `).run(
            business,
            message,
            reply,
            status,
            leadId,
            req.session.businessId
        );

        if (result.changes == 0) {
            return res.status(404).json({
                error: "Lead not found"
            });
        }

        res.json({
            message: "Lead updated successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not edit lead"
        });
    }
});

// ==================== DELETE LEAD ====================

app.delete("/leads/:id", (req, res) => {

    try {

        if (!req.session.businessId) {
            return res.status(401).json({
                error: "Please login first"
            });
        }

        const leadId = req.params.id;

        const result = db.prepare(`
            DELETE FROM leads
            WHERE id = ? AND business_id = ?
        `).run(
            leadId,
            req.session.businessId
        );

        if (result.changes == 0) {
            return res.status(404).json({
                error: "Lead not found"
            });
        }

        res.json({
            message: "Lead deleted successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            error: "Could not delete lead"
        });
    }
});


// ==================== SERVER ====================

app.listen(3000, () => {

    console.log(
        "RevPilot AI running at http://localhost:3000"
    );

});