// nulltranslation.com chapter decryptor for EpubEditor

// parser (WebToEpub) saves each chapter as:
//   <div class="nulltranslation-encrypted"
//        data-nt-encrypted="<base64: IV || ciphertext || GCM tag>"
//        data-nt-key="<base64 AES-256 key>"
//        data-nt-source="<source URL>"
//        data-nt-iv-length="12">
//     [Encrypted chapter content]
//   </div>
//

const SELECTOR = "div.nulltranslation-encrypted";
const GCM_IV_LENGTH = 12;

// base64 -> raw b
function base64ToBytes(b64) {
    let bin = atob(b64);
    let bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}

// AES-GCM decrypt (IV || ciphertext+tag) with raw base64 key -> UTF-8 string
async function decryptContent(b64Encrypted, b64Key) {
    let data = base64ToBytes(b64Encrypted);
    if (data.length <= GCM_IV_LENGTH) {
        throw new Error("Encrypted payload too short");
    }
    let iv = data.slice(0, GCM_IV_LENGTH);
    let ciphertext = data.slice(GCM_IV_LENGTH);

    let keyRaw = atob(b64Key);
    let keyBytes = new Uint8Array(keyRaw.length);
    for (let i = 0; i < keyRaw.length; i++) {
        keyBytes[i] = keyRaw.charCodeAt(i);
    }

    let cryptoKey = await crypto.subtle.importKey(
        "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
    );
    let decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, cryptoKey, ciphertext
    );
    return new TextDecoder("utf-8").decode(decrypted);
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// inline markdown: **bold** -> <strong>, *italic* -> <em>
// should be an external util maybe?
function renderInline(text) {
    return escapeHtml(text)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// render the decrypted markdown-ish plaintext into HTML paragraphs
function renderChapter(text) {
    let normalized = text.replace(/\r\n?/g, "\n").trim();
    if (!normalized) {
        return "";
    }

    let blocks = normalized.split(/\n\s*\n/);
    let html = "";

    for (let block of blocks) {
        let trimmed = block.trim();
        if (!trimmed) {
            continue;
        }

        // horizontal rule
        if (/^[-=]{3,}$/.test(trimmed)) {
            html += "<hr/>";
            continue;
        }

        // heading: line followed by === or ---
        let headingMatch = /^(.+?)\n([-]{3,}|[=]{3,})$/.exec(trimmed);
        if (headingMatch) {
            html += "<h3>" + escapeHtml(headingMatch[1].trim()) + "</h3>";
            continue;
        }

        // paragraph (single newlines -> <br>)
        html += "<p>" + renderInline(trimmed).replace(/\n/g, "<br/>") + "</p>";
    }

    return html;
}

// main
async function decrypt() {
    let containers = [...dom.querySelectorAll(SELECTOR)];
    if (containers.length === 0) {
        return false;
    }

    for (let container of containers) {
        let b64Encrypted = container.getAttribute("data-nt-encrypted");
        let b64Key = container.getAttribute("data-nt-key");
        if (!b64Encrypted || !b64Key) {
            console.warn("Skipping container with missing attributes:", container);
            continue;
        }

        let plaintext;
        try {
            plaintext = await decryptContent(b64Encrypted, b64Key);
        } catch (e) {
            console.error("Decryption failed for", container.getAttribute("data-nt-source"), e);
            continue;
        }

        let html = renderChapter(plaintext);
        // replace with rendered content
        let template = dom.createElement("template");
        template.innerHTML = html;
        let fragment = dom.createDocumentFragment();
        while (template.content.firstChild) {
            fragment.appendChild(template.content.firstChild);
        }
        container.parentNode.replaceChild(fragment, container);
    }

    return true;
}

return await decrypt();
