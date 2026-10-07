const socket = io();
let myPendingRequestId = null;

socket.on("state-update", (data) => {
    // 1. Update file list
    const fileList = document.getElementById("file-list");
    const filesArr = Object.values(data.files);

    if (filesArr.length === 0) {
        fileList.innerHTML =
            '<div class="italic-muted">No files hosted at the moment. Check back soon!</div>';
    } else {
        fileList.innerHTML = filesArr
            .map(
                (f) => `
                    <div class="file-card">
                        <span class="file-name">${f.name}</span>
                        <button onclick="requestDownload('${f.id}', '${f.name}')" class="download-btn">Download</button>
                    </div>
                `,
            )
            .join("");
    }

    // 2. Track Host Decisions
    if (myPendingRequestId) {
        const isApproved = data.approved && data.approved[myPendingRequestId];
        const isRejected =
            data.rejected && data.rejected.includes(myPendingRequestId);

        if (isApproved) {
            const reqIdToDownload = myPendingRequestId;
            myPendingRequestId = null;

            const modalTitle = document.getElementById("modal-title");
            const modalText = document.getElementById("modal-text");
            modalTitle.innerText = "✅ Download Approved!";
            modalText.innerText = "Your high-speed transfer is starting...";

            // Trigger download stream
            window.location.href = `/download/stream/${reqIdToDownload}`;

            setTimeout(() => closeModal(), 3000);
        } else if (isRejected) {
            const modalTitle = document.getElementById("modal-title");
            const modalText = document.getElementById("modal-text");
            modalTitle.innerText = "❌ Request Denied";
            modalText.innerText = "The host rejected your download request.";
            myPendingRequestId = null;
        }
    }
});

async function requestDownload(fileId, fileName) {
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalText = document.getElementById("modal-text");

    modalTitle.innerText = "⏳ Connecting...";
    modalText.innerText = `Requesting "${fileName}"...`;
    modal.style.display = "flex";

    try {
        const response = await fetch(`/download/${fileId}`);
        if (!response.ok) {
            modalTitle.innerText = "❌ Error";
            modalText.innerText = "File not found or server error.";
            return;
        }

        const data = await response.json();

        if (data.status === "approved") {
            modalTitle.innerText = "✅ Download Starting!";
            modalText.innerText = "Your file download is starting...";
            window.location.href = `/download/stream/${data.requestId}`;
            setTimeout(() => closeModal(), 2000);
        } else if (data.status === "pending_approval") {
            myPendingRequestId = data.requestId;
            modalTitle.innerText = "⏳ Waiting for Host Approval";
            modalText.innerText = "The host is reviewing your request...";
        } else if (data.status === "queued") {
            myPendingRequestId = data.requestId;
            modalTitle.innerText = "🚦 Network Busy";
            modalText.innerText = data.message;
        }
    } catch (err) {
        modalTitle.innerText = "❌ Connection Error";
        modalText.innerText = "Failed to communicate with the host server.";
    }
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}
