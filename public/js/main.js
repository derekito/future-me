document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        // Initialize EasyMDE with minimal configuration
        const easyMDE = new EasyMDE({
            element: messageInput,
            spellChecker: false,
            status: false,
            toolbar: ['bold', 'italic'],
            autofocus: false,
            forceSync: true
        });

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
                    easyMDE.value(templates[this.value]);
                } else {
                    easyMDE.value('');
                }
            });
        }

        // Handle form submission
        const form = document.getElementById('future-message-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const message = easyMDE.value();
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
                        easyMDE.value('');
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
    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'confirmation-message';
    confirmationDiv.innerHTML = `
        <div class="confirmation-content">
            <h3>Message Scheduled! ✨</h3>
            <p>Your message has been scheduled for delivery on:</p>
            <p class="delivery-date">${new Date(deliveryDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</p>
            <button class="close-confirmation">Close</button>
        </div>
    `;
    document.body.appendChild(confirmationDiv);

    confirmationDiv.querySelector('.close-confirmation').addEventListener('click', () => {
        confirmationDiv.remove();
    });

    setTimeout(() => {
        confirmationDiv.remove();
    }, 5000);
} 