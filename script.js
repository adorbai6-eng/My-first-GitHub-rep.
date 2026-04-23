// ==================== PixelVault v2.0 - script.js (Fixed & Pure - English Version) ====================

// Web Worker for heavy LSB Steganography processing
const workerCode = `
    self.onmessage = function(e) {
        const { action, imageData, binaryPayload, bitsPerChannel } = e.data;
        const data = imageData.data;

        if (action === 'ENCODE') {
            let dataIndex = 0;
            const totalBits = binaryPayload.length;

            for (let i = 0; i < data.length && dataIndex < totalBits; i += 4) {
                for (let ch = 0; ch < 3 && dataIndex < totalBits; ch++) {
                    const pixelVal = data[i + ch];
                    const mask = \~((1 << bitsPerChannel) - 1);
                    let newVal = pixelVal & mask;

                    let bits = 0;
                    for (let b = 0; b < bitsPerChannel; b++) {
                        if (dataIndex < totalBits) {
                            bits = (bits << 1) | parseInt(binaryPayload[dataIndex++]);
                        } else {
                            bits <<= 1;
                        }
                    }
                    data[i + ch] = newVal | bits;
                }
            }
            self.postMessage({ type: 'done', imageData }, [imageData.data.buffer]);
        } 
        else if (action === 'DECODE') {
            let extractedBits = '';
            let bitCount = 0;
            let payloadLength = 0;
            let isLengthExtracted = false;

            for (let i = 0; i < data.length; i += 4) {
                for (let ch = 0; ch < 3; ch++) {
                    const pixelVal = data[i + ch];
                    for (let b = bitsPerChannel - 1; b >= 0; b--) {
                        const bit = (pixelVal >> b) & 1;
                        extractedBits += bit;
                        bitCount++;

                        if (!isLengthExtracted && bitCount === 32) {
                            payloadLength = parseInt(extractedBits, 2);
                            if (payloadLength === 0 || payloadLength > 8000000) {
                                self.postMessage({ type: 'error', message: 'No hidden data or corrupted image.' });
                                return;
                            }
                            extractedBits = '';
                            bitCount = 0;
                            isLengthExtracted = true;
                        }

                        if (isLengthExtracted && bitCount === payloadLength) {
                            self.postMessage({ type: 'done', binaryData: extractedBits });
                            return;
                        }
                    }
                }
            }
            self.postMessage({ type: 'error', message: 'Reached end of image without finding complete payload.' });
        }
    };
`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

// ==================== AES-256-GCM + PBKDF2 Encryption ====================
async function encryptMessage(plaintext, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(plaintext)
    );

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
}

async function decryptMessage(payload, password) {
    try {
        const data = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const ciphertext = data.slice(28);

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return null;
    }
}

// ==================== Utility Functions ====================
function stringToBinary(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join('');
}

function binaryToString(binary) {
    const bytes = [];
    for (let i = 0; i < binary.length; i += 8) {
        bytes.push(parseInt(binary.slice(i, i + 8), 2));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4500);
}

async function convertToPNG(img) {
    return new Promise(resolve => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        c.toBlob(resolve, 'image/png');
    });
}

async function loadImageFromBlob(blob) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.src = url;
    });
}

// ==================== Main Application ====================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let encodeImg = new Image();
    let decodeImg = new Image();
    let encodeFileIsJpeg = false;

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Drop Zone Setup
    function setupDropZone(zoneId, inputId, previewId, isEncode) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], preview, isEncode);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) handleFile(input.files[0], preview, isEncode);
        });
    }

    function handleFile(file, preview, isEncode) {
        if (!file.type.startsWith('image/')) {
            showToast('Only images (PNG/JPG) are supported', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('File is too large (max 10MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const img = isEncode ? encodeImg : decodeImg;
            img.onload = () => {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
                if (isEncode) {
                    encodeFileIsJpeg = file.type.includes('jpeg') || file.type.includes('jpg');
                    updateCapacity();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    setupDropZone('encodeDropZone', 'encodeImageInput', 'encodePreview', true);
    setupDropZone('decodeDropZone', 'decodeImageInput', 'decodePreview', false);

    // Message Length + Capacity Update
    const msgInput = document.getElementById('secretMessage');
    const lsbSelect = document.getElementById('lsbBits');

    msgInput.addEventListener('input', () => {
        document.getElementById('msgLength').textContent = msgInput.value.length + ' chars';
        updateCapacity();
    });

    lsbSelect.addEventListener('change', updateCapacity);

    function updateCapacity() {
        if (!encodeImg.width) return;
        const bits = parseInt(lsbSelect.value);
        const totalBits = encodeImg.width * encodeImg.height * 3 * bits;
        const headerBits = 32;
        const cryptoOverheadBits = (16 + 12 + 16) * 8;
        const availableBits = totalBits - headerBits - cryptoOverheadBits;
        const maxChars = Math.max(0, Math.floor(availableBits / 8));

        document.getElementById('capacityText').textContent = maxChars.toLocaleString() + ' chars';
        const currentLen = parseInt(document.getElementById('msgLength').textContent) || 0;
        const percent = maxChars > 0 ? Math.min(100, (currentLen / maxChars) * 100) : 0;
        document.getElementById('capacityFill').style.width = percent + '%';
    }

    // Password Strength Meter
    document.getElementById('encodePassword').addEventListener('input', function() {
        const val = this.value;
        const bar = document.getElementById('strengthFill');
        const txt = document.getElementById('strengthText');

        if (!val) {
            bar.style.width = '0%';
            txt.textContent = 'Strength: —';
            return;
        }

        let score = 0;
        if (val.length >= 8) score += 30;
        if (val.length >= 12) score += 20;
        if (/[A-Z]/.test(val)) score += 15;
        if (/[0-9]/.test(val)) score += 15;
        if (/[^A-Za-z0-9]/.test(val)) score += 20;

        bar.style.width = score + '%';

        if (score < 40) {
            bar.style.background = '#ef4444';
            txt.textContent = 'Strength: Weak';
        } else if (score < 70) {
            bar.style.background = '#f59e0b';
            txt.textContent = 'Strength: Medium';
        } else {
            bar.style.background = '#22c55e';
            txt.textContent = 'Strength: Strong ✓';
        }
    });

    // ENCODE
    document.getElementById('btnEncode').addEventListener('click', async () => {
        const msg = document.getElementById('secretMessage').value.trim();
        const pwd = document.getElementById('encodePassword').value;
        const bits = parseInt(lsbSelect.value);
        const btn = document.getElementById('btnEncode');

        if (!encodeImg.src) return showToast('Please select an image first', 'error');
        if (!msg) return showToast('Please enter a message', 'error');
        if (!pwd || pwd.length < 6) return showToast('Password must be at least 6 characters', 'error');

        btn.disabled = true;
        btn.textContent = 'Encoding...';

        try {
            let coverImg = encodeImg;
            if (encodeFileIsJpeg) {
                showToast('Converting JPEG to PNG (lossless)...', 'warning');
                const pngBlob = await convertToPNG(encodeImg);
                coverImg = await loadImageFromBlob(pngBlob);
            }

            canvas.width = coverImg.width;
            canvas.height = coverImg.height;
            ctx.drawImage(coverImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const encryptedPayload = await encryptMessage(msg, pwd);
            const binaryPayload = stringToBinary(encryptedPayload);
            const header = binaryPayload.length.toString(2).padStart(32, '0');
            const fullBinary = header + binaryPayload;

            const availableBits = coverImg.width * coverImg.height * 3 * bits;
            if (fullBinary.length > availableBits) {
                throw new Error('Message is too large! Try a larger image or increase bits.');
            }

            worker.onmessage = e => {
                if (e.data.type === 'done') {
                    ctx.putImageData(e.data.imageData, 0, 0);
                    canvas.toBlob(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `PixelVault_Secured_${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        showToast('✅ Success! PNG downloaded', 'success');
                        btn.disabled = false;
                        btn.textContent = '🔒 Encrypt & Hide Message';
                    }, 'image/png');
                }
            };

            worker.postMessage({
                action: 'ENCODE',
                imageData: imageData,
                binaryPayload: fullBinary,
                bitsPerChannel: bits
            }, [imageData.data.buffer]);

        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = '🔒 Encrypt & Hide Message';
        }
    });

    // DECODE (Fixed - Sequential + Promise based)
    document.getElementById('btnDecode').addEventListener('click', async () => {
        const pwd = document.getElementById('decodePassword').value.trim();
        const btn = document.getElementById('btnDecode');

        if (!decodeImg.src) return showToast('Please upload an encoded PNG', 'error');
        if (!pwd) return showToast('Please enter the password', 'error');

        btn.disabled = true;
        btn.textContent = 'Decoding...';

        try {
            canvas.width = decodeImg.width;
            canvas.height = decodeImg.height;
            ctx.drawImage(decodeImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            let found = false;

            for (let bits = 1; bits <= 3; bits++) {
                const result = await new Promise(resolve => {
                    worker.onmessage = async e => {
                        if (e.data.type === 'done') {
                            const binary = e.data.binaryData;
                            const payloadStr = binaryToString(binary);
                            const plaintext = await decryptMessage(payloadStr, pwd);
                            resolve(plaintext);
                        } else if (e.data.type === 'error') {
                            resolve(null);
                        }
                    };
                    worker.postMessage({
                        action: 'DECODE',
                        imageData: imageData,
                        bitsPerChannel: bits
                    }, [imageData.data.buffer]);
                });

                if (result) {
                    found = true;
                    document.getElementById('decodedMessage').value = result;
                    showToast('✅ Message successfully extracted!', 'success');
                    break;
                }
            }

            if (!found) {
                showToast('❌ Wrong password or no hidden message found', 'error');
            }

        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '🔓 Extract & Decrypt';
        }
    });

    // Copy to Clipboard
    document.getElementById('btnCopy').addEventListener('click', () => {
        const txt = document.getElementById('decodedMessage').value;
        if (txt) {
            navigator.clipboard.writeText(txt).then(() => {
                showToast('✅ Copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
    });
});
