document.getElementById("network-url").innerText = window.location.origin;
const socket = io();

function toggleAutoAccept() {
    fetch("/api/toggle-auto", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
            const btn = document.getElementById("auto-btn");
            btn.innerText = data.autoAccept ? "ON" : "OFF";
            if (data.autoAccept) btn.classList.add("active");
            else btn.classList.remove("active");
        });
}

socket.on("state-update", (data) => {
    document.getElementById("client-count").innerText =
        data.clientCount + " Peers Online";

    const fileList = document.getElementById("file-list");
    const filesArr = Object.values(data.files);
    if (filesArr.length === 0) {
        fileList.innerHTML =
            '<div class="italic-muted">No files uploaded yet.</div>';
    } else {
        fileList.innerHTML = filesArr
            .map(
                (f) => `
                    <div class="list-item">
                        <span class="file-name" title="${f.name}">${f.name}</span>
                        <a href="/download/${f.id}" target="_blank" style="color: #84cc16; text-decoration: none;">Download</a>
                    </div>
                `,
            )
            .join("");
    }

    const reqContainer = document.getElementById("requests-container");
    const reqsArr = Object.values(data.requests);
    if (reqsArr.length === 0) {
        reqContainer.innerHTML =
            '<div class="italic-muted">No pending requests.</div>';
    } else {
        reqContainer.innerHTML = reqsArr
            .map(
                (r) => `
                    <div class="request-card">
                        <div class="request-text">
                            <span class="ip-highlight">${r.clientIP}</span> wants <strong style="color: #84cc16;">${r.fileName}</strong>
                        </div>
                        <div class="btn-group">
                            <button onclick="resolveReq('${r.requestId}', true)" class="btn-accept">Accept</button>
                            <button onclick="resolveReq('${r.requestId}', false)" class="btn-reject">Reject</button>
                        </div>
                    </div>
                `,
            )
            .join("");
    }
});

function resolveReq(requestId, approved) {
    fetch("/api/resolve-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approved }),
    });
}
