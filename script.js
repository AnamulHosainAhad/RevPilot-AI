// ==================== GENERATE AI REPLY ====================

async function generateReply() {

    let business =
        document.getElementById("business").value;

    let message =
        document.getElementById("message").value;

    let output =
        document.getElementById("output");


    if (business.trim() == "") {

        alert("Please enter business name");
        return;

    }


    if (message.trim().length < 5) {

        alert("Please enter a meaningful customer message");
        return;

    }


    output.innerText = "AI is thinking...";


    try {

        // ==================== GENERATE REPLY ====================

        let response = await fetch("/generate", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                business: business,
                message: message
            })

        });


        let data = await response.json();


        if (!data.reply) {

            output.innerText =
                data.error || "Could not generate reply.";

            return;

        }


        output.innerText = data.reply;


        // ==================== AI LEAD SCORING ====================

        let scoreResponse = await fetch("/score-lead", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                business: business,
                message: message
            })

        });


        let scoreData = await scoreResponse.json();


        if (scoreData.score !== undefined) {

            window.currentLeadScore =
                scoreData.score;

            window.currentBuyingIntent =
                scoreData.intent;

            window.currentAIReason =
                scoreData.reason;

            window.currentFollowup =
                scoreData.followup;


            showLeadScore(scoreData);

        }


    } catch (error) {

        console.log(error);

        output.innerText =
            "Could not connect to AI server.";

    }

}


// ==================== SAVE LEAD ====================

async function saveLead() {

    let business =
        document.getElementById("business").value;

    let message =
        document.getElementById("message").value;

    let reply =
        document.getElementById("output").innerText;

    let status =
        document.getElementById("status").value;


    if (
        reply == "" ||
        reply == "Your AI reply will appear here..."
    ) {

        alert("Generate AI reply first!");

        return;
    }


    try {

        let response =
            await fetch("/save-lead", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    business: business,

                    message: message,

                    reply: reply,

                    status: status,

                    leadScore: window.currentLeadScore || 0,

                    buyingIntent:
                        window.currentBuyingIntent || "Low",

                    aiReason:
                        window.currentAIReason || ""

                })
            });


        let data =
            await response.json();


        alert(data.message || data.error);


        if (response.ok) {
            loadDashboard();
        }

    }

    catch (error) {

        alert("Could not save lead.");

        console.log(error);
    }
}



// ==================== SIGNUP ====================

async function signup() {

    let name =
        document.getElementById("signupName").value;

    let email =
        document.getElementById("signupEmail").value;

    let password =
        document.getElementById("signupPassword").value;


    try {

        let response =
            await fetch("/signup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });


        let data =
            await response.json();


        document.getElementById("authMessage")
            .innerText =
            data.message || data.error;

    }

    catch (error) {

        console.log(error);

        document.getElementById("authMessage")
            .innerText =
            "Could not connect to server.";
    }
}



// ==================== LOGIN ====================

async function login() {

    let email =
        document.getElementById("loginEmail").value;

    let password =
        document.getElementById("loginPassword").value;


    try {

        let response =
            await fetch("/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });


        let data =
            await response.json();


        document.getElementById("authMessage")
            .innerText =
            data.message || data.error;


        if (response.ok) {

            loadDashboard();
        }

    }

    catch (error) {

        console.log(error);

        document.getElementById("authMessage")
            .innerText =
            "Could not connect to server.";
    }
}



// ==================== LOGOUT ====================

async function logout() {

    try {

        let response =
            await fetch("/logout", {
                method: "POST"
            });


        let data =
            await response.json();


        document.getElementById("authMessage")
            .innerText =
            data.message;


        document.getElementById("welcome")
            .innerText =
            "Please login first";


        document.getElementById("totalLeads")
            .innerText = "0";

        document.getElementById("hotLeads")
            .innerText = "0";

        document.getElementById("warmLeads")
            .innerText = "0";

        document.getElementById("coldLeads")
            .innerText = "0";


        document.getElementById("dashboardLeads")
            .innerText =
            "Please login to view leads.";

    }

    catch (error) {

        console.log(error);
    }
}



// ==================== DASHBOARD ====================

async function loadDashboard() {

    try {

        // Check logged-in user
        let userResponse =
            await fetch("/me");


        let user =
            await userResponse.json();


        if (!user.loggedIn) {

            document.getElementById("welcome")
                .innerText =
                "Please login first";

            return;
        }


        // Welcome message
        document.getElementById("welcome")
            .innerText =
            "Welcome, " +
            user.businessName +
            " 👋";
        document.getElementById("navBusinessName").innerText =
            user.businessName;    


        // Get leads
        let response =
            await fetch("/leads");


        let leads =
            await response.json();


        window.allLeads = leads;

        

        let now = new Date();

        let pendingNotifications = leads.filter(function(lead) {

            if (!lead.followup_date) {
                return false;
            }

            if (lead.followup_sent == 1) {
                return false;
            }

            let followupTime = new Date(lead.followup_date);

            return followupTime <= now;
        });

        let notificationCount = pendingNotifications.length;

        document.getElementById("notificationCount").innerText =
            notificationCount;

        document.getElementById("notificationTitleCount").innerText =
            notificationCount;

        let notificationList =
            document.getElementById("notificationList");

        if (pendingNotifications.length == 0) {

            notificationList.innerHTML = `
                <div class="no-notification">
                    No due follow-ups.
                </div>
            `;

        } else {

            let notificationHTML = "";

            pendingNotifications.forEach(function(lead) {

                notificationHTML += `
                    <div class="notification-item"
                        onclick="showLeadDetails(${lead.id})">

                        <strong>⏰ Follow-up Due</strong>

                        <p>
                            ${lead.business || "Customer"}
                        </p>

                        <small>
                            Follow-up: ${lead.followup_date}
                        </small>

                    </div>
                `;
            });

            notificationList.innerHTML =
                notificationHTML;
        }


        // Total leads
        document.getElementById("totalLeads")
            .innerText =
            leads.length;


        // Count status
        let hot = 0;
        let warm = 0;
        let cold = 0;


        leads.forEach(function(lead) {

            let status =
                String(lead.status).toUpperCase();


            if (status == "HOT") {
                hot++;
            }

            if (status == "WARM") {
                warm++;
            }

            if (status == "COLD") {
                cold++;
            }

        });


        document.getElementById("hotLeads")
            .innerText = hot;

        document.getElementById("warmLeads")
            .innerText = warm;

        document.getElementById("coldLeads")
            .innerText = cold;
        
        // Revenue Analytics

let convertedCount = 0;
let totalRevenue = 0;

leads.forEach(function(lead) {

    if (lead.converted == 1) {

        convertedCount++;

        totalRevenue +=
            Number(lead.revenue || 0);
    }

});

let conversionRate = 0;

if (leads.length > 0) {

    conversionRate =
        (convertedCount / leads.length) * 100;

}

document.getElementById("totalRevenue").innerText =
    "$" + totalRevenue.toFixed(2);

document.getElementById("convertedLeads").innerText =
    convertedCount;

document.getElementById("conversionRate").innerText =
    conversionRate.toFixed(1) + "%";   
    
    // Average Revenue

let avgRevenue = 0;

if (convertedCount > 0) {

    avgRevenue =
        totalRevenue / convertedCount;

}


// Today's Revenue

let todayRevenue = 0;

let today =
    new Date().toISOString().split("T")[0];

leads.forEach(function(lead) {

    if (
        lead.converted == 1 &&
        lead.created_at &&
        lead.created_at.startsWith(today)
    ) {

        todayRevenue +=
            Number(lead.revenue || 0);

    }

});


document.getElementById("avgRevenue").innerText =
    "$" + avgRevenue.toFixed(2);

document.getElementById("todayRevenue").innerText =
    "$" + todayRevenue.toFixed(2);

        // Display leads
        displayLeads(leads);

        loadRevenueChart(leads);

        // ==================== PROFESSIONAL CONVERSION FUNNEL ====================

let totalLeads =
    leads.length;

let hotLeads =
    leads.filter(function(lead) {
        return String(lead.status || "").toUpperCase() == "HOT";
    }).length;

let convertedLeads =
    leads.filter(function(lead) {
        return lead.converted == 1;
    }).length;

let totalRevenueFunnel = 0;

leads.forEach(function(lead) {

    if (lead.converted == 1) {

        totalRevenueFunnel +=
            Number(lead.revenue || 0);

    }

});

let hotPercentage = 0;
let convertedPercentage = 0;

if (totalLeads > 0) {

    hotPercentage =
        (hotLeads / totalLeads) * 100;

    convertedPercentage =
        (convertedLeads / totalLeads) * 100;

}

let funnel =
    document.getElementById("conversionFunnel");

funnel.innerHTML = `

    <div class="funnel-container">

        <div class="funnel-step">

            <div class="funnel-left">

                <span class="funnel-icon">
                    👥
                </span>

                <span class="funnel-name">
                    All Leads
                </span>

            </div>

            <div>

                <span class="funnel-number">
                    ${totalLeads}
                </span>

                <span class="funnel-percent">
                    100%
                </span>

            </div>

        </div>


        <div class="funnel-arrow">
            ↓
        </div>


        <div class="funnel-step">

            <div class="funnel-left">

                <span class="funnel-icon">
                    🔥
                </span>

                <span class="funnel-name">
                    Hot Leads
                </span>

            </div>

            <div>

                <span class="funnel-number">
                    ${hotLeads}
                </span>

                <span class="funnel-percent">
                    ${hotPercentage.toFixed(1)}%
                </span>

            </div>

        </div>


        <div class="funnel-arrow">
            ↓
        </div>


        <div class="funnel-step">

            <div class="funnel-left">

                <span class="funnel-icon">
                    💰
                </span>

                <span class="funnel-name">
                    Converted Leads
                </span>

            </div>

            <div>

                <span class="funnel-number">
                    ${convertedLeads}
                </span>

                <span class="funnel-percent">
                    ${convertedPercentage.toFixed(1)}%
                </span>

            </div>

        </div>


        <div class="funnel-arrow">
            ↓
        </div>


        <div class="funnel-step">

            <div class="funnel-left">

                <span class="funnel-icon">
                    💵
                </span>

                <span class="funnel-name">
                    Revenue Generated
                </span>

            </div>

            <div>

                <span class="funnel-number">
                    $${totalRevenueFunnel.toFixed(2)}
                </span>

            </div>

        </div>

    </div>

`;
    }

    catch (error) {

        console.log(error);
    }
}



// ==================== SEARCH + FILTER ====================

function filterLeads() {

    let search =
        document.getElementById("searchLead").value
        .toLowerCase();

    let status =
        document.getElementById("filterStatus").value;

    let sort =
        document.getElementById("sortLeads").value;

    let leads =
        window.allLeads || [];


    // Search filter
    leads = leads.filter(function(lead) {

        let business =
            (lead.business || "").toLowerCase();

        let message =
            (lead.message || "").toLowerCase();

        return (
            business.includes(search) ||
            message.includes(search)
        );

    });


    // Status filter
    if (status != "All") {

        leads = leads.filter(function(lead) {

            return lead.status.toUpperCase() ==
                   status;

        });

    }


    // Sorting
    if (sort == "newest") {

        leads.sort(function(a, b) {

            return new Date(b.created_at) -
                   new Date(a.created_at);

        });

    }


    if (sort == "oldest") {

        leads.sort(function(a, b) {

            return new Date(a.created_at) -
                   new Date(b.created_at);

        });

    }


    if (sort == "highRevenue") {

        leads.sort(function(a, b) {

            return Number(b.revenue || 0) -
                   Number(a.revenue || 0);

        });

    }


    if (sort == "lowRevenue") {

        leads.sort(function(a, b) {

            return Number(a.revenue || 0) -
                   Number(b.revenue || 0);

        });

    }


    displayLeads(leads);
}


// ==================== DISPLAY LEADS ====================

function displayLeads(leads) {

    let output =
        document.getElementById("dashboardLeads");

    let count =
        document.getElementById("leadCount");

    count.innerText =
        leads.length + (leads.length == 1 ? " lead" : " leads");    


    output.innerHTML = "";


    if (leads.length == 0) {

        output.innerText =
            "No leads found.";

        return;
    }


    leads.forEach(function(lead) {

        let status =
            String(lead.status || "")
                .toUpperCase();


        let revenue =
            Number(lead.revenue || 0);


        let followup =
            lead.followup_date
            ? "⏰ Scheduled"
            : "—";


        let converted =
            lead.converted == 1
            ? "✅ Converted"
            : "🔵 Not Converted";


        output.innerHTML += `

            <div class="lead">

                <div class="lead-top">

                    <h3>
                        Lead #${lead.id}
                    </h3>

                    <span class="status status-${status.toLowerCase()}">
                        ${
                            status === "HOT"
                                ? "🔥 HOT"
                                : status === "WARM"
                                ? "🟡 WARM"
                                : "⚪ COLD"
                        }
                    </span>

                </div>

                <div class="lead-ai-info">

                    <span>
                        🧠 Score:
                        <strong>${lead.lead_score || 0}/100</strong>
                    </span>

                    <span>
                        🎯
                        ${lead.buying_intent || "Low"} Intent
                    </span>

                </div>

                <p>
                    <b>🏪 Business:</b>
                    ${lead.business || "N/A"}
                </p>


                <p>
                    <b>💬 Customer:</b>
                    ${lead.message || "No message"}
                </p>


                <p>
                    <b>💰 Revenue:</b>
                    $${revenue.toFixed(2)}
                </p>


                <p>
                    <b>🔄 Conversion:</b>
                    ${converted}
                </p>


                <p>
                    <b>⏰ Follow-up:</b>
                    ${followup}
                </p>


                <p>
                    <b>📅 Created:</b>
                    ${lead.created_at}
                </p>


                <div class="lead-buttons">

                    <button
                        onclick="showLeadDetails(${lead.id})"
                    >
                        👁️ View Details
                    </button>


                    <button
                        onclick="generateFollowup(${lead.id})"
                    >
                        🔄 Generate Follow-up
                    </button>


                    <button
                        onclick="deleteLead(${lead.id})"
                    >
                        🗑️ Delete
                    </button>

                </div>

            </div>

        `;
    });
}


// ==================== VIEW LEAD DETAILS ====================

function showLeadDetails(id) {

    let leads =
        window.allLeads || [];

    let lead =
        leads.find(function(item) {

            return item.id == id;

        });

    if (!lead) {
        return;
    }

    let modal =
        document.getElementById("leadModal");

    let content =
        document.getElementById("modalContent");


    content.innerHTML = `

        <div class="lead-summary">

    <div class="summary-header">
        <h2>Lead #${lead.id}</h2>

        <span class="status status-${String(lead.status || "").toLowerCase()}">
            ${String(lead.status || "").toUpperCase()}
        </span>
    </div>

    <p>
        🏪 <strong>Business:</strong>
        ${lead.business || "N/A"}
    </p>

    <div class="summary-stats">

        <div>
            <strong>💰 Revenue</strong>
            <br>
            $${Number(lead.revenue || 0).toFixed(2)}
        </div>

        <div>
            <strong>🔄 Conversion</strong>
            <br>
            ${lead.converted == 1 ? "✅ Converted" : "🔵 Not Converted"}
        </div>

        <div>
            <strong>⏰ Follow-up</strong>
            <br>
            ${lead.followup_date ? "Scheduled" : "Not Scheduled"}
        </div>

    </div>

</div>

<hr>
        <p>
            <b>Lead ID:</b>
            ${lead.id}
        </p>

        <p>
            <b>Customer Message:</b>
            ${lead.message}
        </p>

        <p>
            <b>Lead Status:</b>
            ${lead.status}
        </p>

        <div class="ai-detail-card">

            <h3>🧠 AI Lead Analysis</h3>

            <p>
                <b>Lead Score:</b>
                ${lead.lead_score || 0}/100
            </p>

            <p>
                <b>Buying Intent:</b>
                ${lead.buying_intent || "Low"}
            </p>

            <p>
                <b>Why:</b>
                ${lead.ai_reason || "No reason available"}
            </p>

            <div class="ai-followup-detail">
                <b>🎯 Recommended Follow-up:</b>
                <p>
                    ${lead.followup_message || "No recommendation available"}
                </p>
            </div>

        </div>

<p><b>AI Reply:</b></p>

        <p>
            <b>AI Reply:</b>
        </p>

        <div class="ai-reply">
            ${lead.reply}
        </div>

        <p>
            <b>Created:</b>
            ${lead.created_at}
        </p>

        <hr>

        <hr>

<h3>⏰ Follow-up</h3>

<div class="followup-card">

    ${
        lead.followup_date
        ? `
            <p>
                <strong>📅 Scheduled:</strong>
                ${lead.followup_date}
            </p>

            <p>
                <strong>💬 Message:</strong>
            </p>

            <div class="followup-message">
                ${lead.followup_message || "No message"}
            </div>

            <p>
                <strong>Status:</strong>

                ${
                    lead.followup_sent == 1
                    ? "✅ Completed"
                    : "⏳ Pending"
                }
            </p>
        `
        : `
            <p>📭 No follow-up scheduled.</p>

            <button
                onclick="generateFollowup(${lead.id})"
            >
                🔄 Generate Follow-up
            </button>
        `
    }

</div>

        <h3>📋 Lead Timeline</h3>

        <div class="timeline">

            <div class="timeline-item">
                🟢 <strong>Lead Created</strong>
                <br>
                <small>${lead.created_at}</small>
            </div>

            <div class="timeline-item">
                🤖 <strong>AI Reply Generated</strong>
            </div>

            ${
                lead.followup_date
                ? `
                    <div class="timeline-item">
                        ⏰ <strong>Follow-up Scheduled</strong>
                        <br>
                        <small>${lead.followup_date}</small>
                    </div>
                `
                : `
                    <div class="timeline-item">
                        ⏳ <strong>No Follow-up Scheduled</strong>
                    </div>
                `
            }

            ${
                lead.followup_sent == 1
                ? `
                    <div class="timeline-item">
                        ✅ <strong>Follow-up Completed</strong>
                    </div>
                `
                : ""
            }

            ${
                lead.converted == 1
                ? `
                    <div class="timeline-item">
                        💰 <strong>Lead Converted</strong>
                        <br>
                        <small>Revenue: $${lead.revenue || 0}</small>
                    </div>
                `
                : `
                    <div class="timeline-item">
                        🔵 <strong>Not Converted Yet</strong>
                    </div>
                `
            }

        </div>

        <hr>

        <h3>💰 Conversion</h3>

        <p>
            <strong>Converted:</strong>
            ${lead.converted == 1 ? "✅ Yes" : "❌ No"}
        </p>

        <p>
            <strong>Revenue:</strong>
            $${lead.revenue || 0}
        </p>

        ${
            lead.converted == 0
            ? `
                <input
                    type="number"
                    id="revenueInput"
                    placeholder="Enter revenue amount"
                    min="0"
                    step="0.01"
                    style="width:100%; padding:10px; margin-top:10px;"
                >

                <br><br>

                <button
                    onclick="markAsConverted(${lead.id})"
                >
                    💰 Mark as Converted
                </button>
            `
            : `
                <p>🎉 This lead is already converted.</p>
            `
        }

        <hr>

        <button onclick="editLead(${lead.id})">
            ✏️ Edit Lead
        </button>

        <button onclick="deleteLead(${lead.id})">
            🗑️ Delete Lead
        </button>

    `;


    modal.style.display =
        "block";
}

// ==================== CLOSE MODAL ====================

function closeLeadModal() {

    document.getElementById("leadModal")
        .style.display =
        "none";
}



// ==================== DELETE LEAD ====================

async function deleteLead(id) {

    let confirmDelete =
        confirm(
            "Are you sure you want to delete this lead?"
        );


    if (!confirmDelete) {
        return;
    }


    try {

        let response =
            await fetch(
                "/leads/" + id,
                {
                    method: "DELETE"
                }
            );


        let data =
            await response.json();


        alert(
            data.message ||
            data.error
        );


        if (response.ok) {

            loadDashboard();
        }

    }

    catch (error) {

        console.log(error);

        alert(
            "Could not delete lead."
        );
    }
}



// ==================== LOAD DASHBOARD ====================

loadDashboard();

// ==================== GENERATE FOLLOW-UP ====================

async function generateFollowup(id) {

    let leads =
        window.allLeads || [];


    let lead =
        leads.find(function(item) {

            return item.id == id;

        });


    if (!lead) {
        return;
    }


    try {

        let response =
            await fetch("/generate-followup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    message: lead.message,

                    reply: lead.reply,

                    status: lead.status

                })

            });


        let data =
            await response.json();


        if (!response.ok) {

            alert(data.error);

            return;
        }


        let modal =
            document.getElementById("leadModal");


        let content =
            document.getElementById("modalContent");


        content.innerHTML = `

            <h3>
                🔄 AI Follow-up Message
            </h3>


            <textarea
                id="followupText"
                style="width:100%; height:100px;"
            >${data.followup}</textarea>


            <br><br>


            <label>
                Follow-up Date & Time
            </label>


            <input
                type="datetime-local"
                id="followupDate"
                style="width:100%; padding:10px;"
            >


            <br><br>


            <button
                onclick="saveFollowup(${lead.id})"
            >
                💾 Save Follow-up
            </button>


            <button
                onclick="closeLeadModal()"
            >
                Close
            </button>

        `;


        modal.style.display =
            "block";


    } catch (error) {

        console.log(error);

        alert(
            "Could not generate follow-up."
        );
    }
}

// ==================== SAVE FOLLOW-UP ====================

async function saveFollowup(id) {

    let followupMessage =
        document.getElementById("followupText").value;


    let followupDate =
        document.getElementById("followupDate").value;


    if (followupMessage.trim() == "") {

        alert("Follow-up message is empty.");

        return;
    }


    if (followupDate == "") {

        alert("Please select follow-up date and time.");

        return;
    }


    try {

        let response =
            await fetch("/save-followup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    leadId: id,

                    followupMessage:
                        followupMessage,

                    followupDate:
                        followupDate

                })

            });


        let data =
            await response.json();


        alert(
            data.message ||
            data.error
        );


        if (response.ok) {

            closeLeadModal();

            loadDashboard();
        }


    } catch (error) {

        console.log(error);

        alert(
            "Could not save follow-up."
        );
    }
}

// ==================== CHECK DUE FOLLOW-UPS ====================

async function checkDueFollowups() {

    try {

        let response =
            await fetch("/due-followups");

        let data =
            await response.json();

        let container =
            document.getElementById("dueFollowups");

        if (!response.ok) {
            return;
        }

        if (data.length === 0) {

            container.innerHTML =
                "<p>No follow-ups due. ✅</p>";

            return;
        }

        container.innerHTML = "";

        data.forEach(function(lead) {

            container.innerHTML += `

                <div class="lead due-lead">

                    <div class="lead-top">

                        <strong>
                            ${lead.business}
                        </strong>

                        <span class="status">
                            ⏰ DUE
                        </span>

                    </div>

                    <p>
                        <strong>Customer:</strong>
                        ${lead.message}
                    </p>

                    <p>
                        <strong>Follow-up:</strong>
                        ${lead.followup_message}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${lead.followup_date}
                    </p>

                    <div class="lead-buttons">

                        <button
                            onclick="showLeadDetails(${lead.id})"
                        >
                            👁️ View Details
                        </button>

                        <button
                            onclick="completeFollowup(${lead.id})"
                        >
                            ✅ Mark as Done
                        </button>

                    </div>

                </div>

            `;
        });

    } catch (error) {

        console.log(error);

    }
}

checkDueFollowups();

// ==================== COMPLETE FOLLOW-UP ====================

async function completeFollowup(id) {

    try {

        let response =
            await fetch("/complete-followup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    leadId: id
                })

            });

        let data =
            await response.json();

        if (!response.ok) {

            alert(data.error);

            return;
        }

        alert(data.message);

        // Refresh due follow-ups
        checkDueFollowups();

        // Refresh dashboard
        loadDashboard();

    } catch (error) {

        console.log(error);

        alert(
            "Could not complete follow-up."
        );
    }
}

// ==================== MARK AS CONVERTED ====================

async function markAsConverted(id) {

    let revenue =
        document.getElementById("revenueInput").value;

    if (revenue == "") {

        alert("Please enter revenue amount.");

        return;
    }

    try {

        let response =
            await fetch("/mark-converted", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    leadId: id,

                    revenue: revenue

                })

            });

        let data =
            await response.json();

        if (!response.ok) {

            alert(data.error);

            return;
        }

        alert(data.message);

        closeLeadModal();

        loadDashboard();

    } catch (error) {

        console.log(error);

        alert(
            "Could not mark lead as converted."
        );
    }
}

// ==================== REVENUE CHART ====================

function loadRevenueChart(leads) {

    let revenueData = {};

    leads.forEach(function(lead) {

        if (
            lead.converted == 1 &&
            Number(lead.revenue || 0) > 0
        ) {

            let date =
                lead.created_at.split(" ")[0];

            if (!revenueData[date]) {
                revenueData[date] = 0;
            }

            revenueData[date] +=
                Number(lead.revenue || 0);
        }

    });


    let dates =
        Object.keys(revenueData).sort();


    let chart =
        document.getElementById("revenueChart");


    if (dates.length == 0) {

        chart.innerHTML = `
            <div class="revenue-empty">
                📊 No revenue data yet.
            </div>
        `;

        return;
    }


    /* Find highest revenue */

    let maxRevenue = 0;

    dates.forEach(function(date) {

        if (revenueData[date] > maxRevenue) {

            maxRevenue =
                revenueData[date];

        }

    });


    let html = "";


    dates.forEach(function(date) {

        let revenue =
            revenueData[date];


        let percentage =
            (revenue / maxRevenue) * 100;


        html += `

            <div class="revenue-row">

                <div class="revenue-header">

                    <span class="revenue-date">
                        📅 ${date}
                    </span>

                    <span class="revenue-amount">
                        $${revenue.toFixed(2)}
                    </span>

                </div>


                <div class="revenue-track">

                    <div
                        class="revenue-bar"
                        style="width:${percentage}%"
                    ></div>

                </div>

            </div>

        `;

    });


    chart.innerHTML = html;
}

// ==================== EDIT LEAD ====================

function editLead(id) {

    let leads = window.allLeads || [];

    let lead = leads.find(function(item) {
        return item.id == id;
    });

    if (!lead) {
        alert("Lead not found.");
        return;
    }

    let modal = document.getElementById("leadModal");
    let content = document.getElementById("modalContent");

    content.innerHTML = `
        <h3>✏️ Edit Lead</h3>

        <label>Business Name</label>
        <input
            type="text"
            id="editBusiness"
            value="${lead.business || ""}"
            style="width:100%; padding:10px;"
        >

        <br><br>

        <label>Customer Message</label>
        <textarea
            id="editMessage"
            style="width:100%; height:100px;"
        >${lead.message || ""}</textarea>

        <br><br>

        <label>AI Reply</label>
        <textarea
            id="editReply"
            style="width:100%; height:100px;"
        >${lead.reply || ""}</textarea>

        <br><br>

        <label>Lead Status</label>

        <select
            id="editStatus"
            style="width:100%; padding:10px;"
        >
            <option value="Cold" ${lead.status == "Cold" ? "selected" : ""}>
                Cold
            </option>

            <option value="Warm" ${lead.status == "Warm" ? "selected" : ""}>
                Warm
            </option>

            <option value="Hot" ${lead.status == "Hot" ? "selected" : ""}>
                Hot
            </option>
        </select>

        <br><br>

        <button onclick="updateLead(${lead.id})">
            💾 Save Changes
        </button>

        <button onclick="showLeadDetails(${lead.id})">
            Cancel
        </button>
    `;

    modal.style.display = "block";
}

// ==================== UPDATE LEAD ====================

async function updateLead(id) {

    let business =
        document.getElementById("editBusiness").value;

    let message =
        document.getElementById("editMessage").value;

    let reply =
        document.getElementById("editReply").value;

    let status =
        document.getElementById("editStatus").value;

    if (
        business.trim() == "" ||
        message.trim() == "" ||
        reply.trim() == ""
    ) {
        alert("Please fill all fields.");
        return;
    }

    try {

        let response =
            await fetch("/edit-lead", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    leadId: id,
                    business: business,
                    message: message,
                    reply: reply,
                    status: status
                })
            });

        let data =
            await response.json();

        if (!response.ok) {
            alert(data.error);
            return;
        }

        alert(data.message);

        closeLeadModal();

        loadDashboard();

    } catch (error) {

        console.log(error);

        alert("Could not update lead.");
    }
}

// ================================
// DASHBOARD NAVIGATION
// ================================

function scrollToSection(id) {

    let section = document.getElementById(id);

    if (section) {
        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

}

// ================================
// NOTIFICATION DROPDOWN
// ================================

function toggleNotifications() {

    let dropdown =
        document.getElementById("notificationDropdown");

    dropdown.classList.toggle("show");

}

// ==================== AUTO DUE NOTIFICATION ====================

setInterval(async function() {

    try {

        let response = await fetch("/due-followups");

        if (!response.ok) {
            return;
        }

        let dueLeads = await response.json();

        let count = dueLeads.length;

        document.getElementById("notificationCount").innerText =
            count;

        document.getElementById("notificationTitleCount").innerText =
            count;

        let notificationList =
            document.getElementById("notificationList");

        if (count == 0) {

            notificationList.innerHTML = `
                <div class="no-notification">
                    No due follow-ups.
                </div>
            `;

        } else {

            let html = "";

            dueLeads.forEach(function(lead) {

                html += `
                    <div class="notification-item"
                         onclick="showLeadDetails(${lead.id})">

                        <strong>⏰ Follow-up Due</strong>

                        <p>
                            ${lead.business || "Customer"}
                        </p>

                        <small>
                            Follow-up: ${lead.followup_date}
                        </small>

                    </div>
                `;

            });

            notificationList.innerHTML = html;
        }

    } catch (error) {

        console.log("Notification check failed:", error);

    }

}, 30000);

// ==================== LIVE DASHBOARD STATS ====================

setInterval(async function () {

    try {

        let response = await fetch("/leads");

        if (!response.ok) {
            return;
        }

        let leads = await response.json();

        window.allLeads = leads;

        // Total Leads
        document.getElementById("totalLeads").innerText =
            leads.length;

        // Hot Leads
        let hot = leads.filter(function (lead) {
            return String(lead.status || "").toUpperCase() == "HOT";
        }).length;

        document.getElementById("hotLeads").innerText = hot;

        // Warm Leads
        let warm = leads.filter(function (lead) {
            return String(lead.status || "").toUpperCase() == "WARM";
        }).length;

        document.getElementById("warmLeads").innerText = warm;

        // Cold Leads
        let cold = leads.filter(function (lead) {
            return String(lead.status || "").toUpperCase() == "COLD";
        }).length;

        document.getElementById("coldLeads").innerText = cold;

        // Converted + Revenue
        let converted = 0;
        let revenue = 0;

        leads.forEach(function (lead) {

            if (lead.converted == 1) {

                converted++;

                revenue += Number(lead.revenue || 0);
            }
        });

        document.getElementById("convertedLeads").innerText =
            converted;

        document.getElementById("totalRevenue").innerText =
            "$" + revenue.toFixed(2);

        // Conversion Rate
        let rate = 0;

        if (leads.length > 0) {
            rate = (converted / leads.length) * 100;
        }

        document.getElementById("conversionRate").innerText =
            rate.toFixed(1) + "%";

    } catch (error) {

        console.log("Live stats error:", error);

    }

}, 30000);

// ==================== SHOW AI LEAD SCORE ====================

function showLeadScore(data) {

    let existing =
        document.getElementById("aiLeadScore");

    if (!existing) {

        existing = document.createElement("div");

        existing.id = "aiLeadScore";

        document.getElementById("output")
            .parentElement
            .appendChild(existing);

    }


    let emoji = "❄️";

    if (data.score >= 80) {

        emoji = "🔥";

    } else if (data.score >= 50) {

        emoji = "🟡";

    }


    existing.innerHTML = `

        <div class="ai-score-card">

            <div class="ai-score-header">

                <h3>
                    🧠 AI Lead Analysis
                </h3>

                <span class="ai-score-number">
                    ${data.score}/100
                </span>

            </div>


            <div class="ai-intent">

                ${emoji}

                <strong>
                    ${data.intent} Buying Intent
                </strong>

            </div>


            <p>

                <strong>Why:</strong>

                ${data.reason}

            </p>


            <div class="ai-followup">

                <strong>
                    🎯 Recommended Follow-up
                </strong>

                <p>
                    ${data.followup}
                </p>

            </div>

        </div>

    `;

}