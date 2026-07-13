// cherymist deobfuscator

// parser (WebToEpub) saves the obfuscated ghost payload as:
//   <div class="fictioneer-ghost-encrypted"
//        data-fc-encrypted="<rot13(base64(encodeURIComponent(html)))>"
//        data-fc-poly="<poly>"
//        data-fc-total="<total>"
//        data-fc-source="<source URL>">
//     [Encrypted chapter content]
//   </div>
//
// encoding (from FictioneerParser.processGhostContent):
//   encodeURIComponent -> btoa -> rot13
// so decoding reverses it: rot13 -> atob -> decodeURIComponent

const SELECTOR = "div.fictioneer-ghost-encrypted";

function rot13(str) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code >= 65 && code <= 90) {
            result += String.fromCharCode((code - 65 + 13) % 26 + 65);
        } else if (code >= 97 && code <= 122) {
            result += String.fromCharCode((code - 97 + 13) % 26 + 97);
        } else {
            result += str[i];
        }
    }
    return result;
}

function decodeGhost(encoded) {
    return decodeURIComponent(atob(rot13(encoded)));
}

function decrypt() {
    let containers = [...dom.querySelectorAll(SELECTOR)];
    if (containers.length === 0) {
        return false;
    }

    for (let container of containers) {
        let encoded = container.getAttribute("data-fc-encrypted");
        if (!encoded) {
            console.warn("Skipping container with missing data-fc-encrypted:", container);
            continue;
        }

        let html;
        try {
            html = decodeGhost(encoded);
        } catch (e) {
            console.error("Decryption failed for", container.getAttribute("data-fc-source"), e);
            continue;
        }

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

return decrypt();
