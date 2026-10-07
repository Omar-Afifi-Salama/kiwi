const socket = io();

socket.on("state-update", (data) => {
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
});

async function requestDownload(fileId, fileName) {
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modal-title");
    const modalText = document.getElementById("modal-text");

    modalTitle.innerText = "⏳ Waiting for Host Approval";
    modalText.innerText = `Requesting "${fileName}" from host. Please wait...`;
    modal.style.display = "flex";

    try {
        const response = await fetch(`/download/${fileId}`);

        if (response.ok) {
            modalTitle.innerText = "✅ Download Approved!";
            modalText.innerText = "Your file download is starting...";

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            setTimeout(() => {
                modal.style.display = "none";
            }, 2000);
        } else {
            modalTitle.innerText = "❌ Request Denied";
            modalText.innerText =
                "The host rejected or timed out your download request.";
        }
    } catch (err) {
        modalTitle.innerText = "❌ Connection Error";
        modalText.innerText = "Failed to communicate with the host server.";
    }
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}
