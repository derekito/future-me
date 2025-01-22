document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        // Initialize EasyMDE with storage disabled
        const easyMDE = new EasyMDE({
            element: messageInput,
            spellChecker: false,
            status: false,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', '|', 'guide'
            ],
            autosave: false,
            localStorage: false,
            forceSync: true
        });

        // Sync EasyMDE content with textarea
        easyMDE.codemirror.on('change', () => {
            messageInput.value = easyMDE.value();
        });

        // Templates
        const templates = {
            'goals': `# My Goals for the Future\n\nDear Future Me,\n\nHere are the goals I'm working towards:\n\n1. \n2. \n3. \n\nRemember why you started this journey!\n\nBest wishes,\nPast Me`,
            'reflection': `# Reflecting on Today\n\nDear Future Me,\n\nToday I'm feeling:\n\nThree things I'm grateful for:\n1. \n2. \n3. \n\nWhat I hope will change by the time you read this:\n\nTake care,\nPast Me`,
            'letter': `Dear Future Me,\n\nI hope this message finds you well. As I write this, I want to share some thoughts with you:\n\nWhat's important to me right now:\n\nWhat I'm excited about:\n\nWhat I'm worried about:\n\nMy hopes for you:\n\nWith love,\nPast Me`
        };

        // Handle template selection
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', function() {
                if (this.value && templates[this.value]) {
                    easyMDE.value(templates[this.value]);
                    messageInput.value = templates[this.value];
                } else {
                    easyMDE.value('');
                    messageInput.value = '';
                }
            });
        }

        // Handle form submission
        const form = document.getElementById('future-message-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                messageInput.value = easyMDE.value();
                
                if (!messageInput.value.trim()) {
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
                            message: messageInput.value,
                            email: form.querySelector('#email').value,
                            deliveryTime: form.querySelector('#delivery-time').value
                        })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        showConfirmation(result.deliveryDate);
                        easyMDE.value('');
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