document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        // Templates
        const templates = {
            'goals': `Dear Future Me,\n\nHere are the goals I'm working towards:\n\n1. \n2. \n3. \n\nBest wishes,\nPast Me`,
            'reflection': `Dear Future Me,\n\nToday I'm feeling:\n\nThree things I'm grateful for:\n1. \n2. \n3. \n\nTake care,\nPast Me`,
            'letter': `Dear Future Me,\n\nI hope this message finds you well.\n\nWith love,\nPast Me`
        };

        // Handle template selection
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', function() {
                if (this.value && templates[this.value]) {
                    messageInput.value = templates[this.value];
                } else {
                    messageInput.value = '';
                }
            });
        }

        // Handle form submission
        const form = document.getElementById('future-message-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const message = messageInput.value;
                if (!message.trim()) {
                    alert('Please write a message before submitting.');
                    return;
                }

                try {
                    const response = await fetch('/api/messages', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: message,
                            email: form.querySelector('#email').value,
                            deliveryTime: form.querySelector('#delivery-time').value
                        })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        showConfirmation(result.deliveryDate);
                        messageInput.value = '';
                        form.reset();
                    } else {
                        throw new Error(result.error || 'Failed to send message');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('There was an error sending your message. Please try again.');
                }
            });
        }
    }
});

function showConfirmation(deliveryDate) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    document.body.appendChild(overlay);

    // Create confirmation popup
    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'confirmation-popup';
    
    // Add Ganesha image
    const ganeshaImg = document.createElement('img');
    ganeshaImg.src = '/images/ganesha.svg';  // Changed from .png to .svg
    ganeshaImg.alt = 'Ganesha';
    ganeshaImg.className = 'ganesha-icon';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-confirmation';
    closeButton.innerHTML = '×';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Message Scheduled!';
    
    const message = document.createElement('p');
    message.textContent = `Your message will be delivered on ${new Date(deliveryDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}.`;
    
    confirmationDiv.appendChild(closeButton);
    confirmationDiv.appendChild(ganeshaImg);
    confirmationDiv.appendChild(heading);
    confirmationDiv.appendChild(message);
    document.body.appendChild(confirmationDiv);

    // Close handlers
    function removePopup() {
        document.body.removeChild(confirmationDiv);
        document.body.removeChild(overlay);
    }

    closeButton.addEventListener('click', removePopup);
    overlay.addEventListener('click', removePopup);

    // Auto-remove after 30 seconds instead of 5
    setTimeout(removePopup, 30000);
} 