document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        // Initialize EasyMDE
        const easyMDE = new EasyMDE({
            element: messageInput,
            spellChecker: false,
            status: false,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', '|', 'guide'
            ]
        });

        // Sync EasyMDE content with textarea
        easyMDE.codemirror.on('change', () => {
            messageInput.value = easyMDE.value();
        });

        // Templates
        const templates = {
            'goals': `# My Goals for the Future

Dear Future Me,

Here are the goals I'm working towards:

1. 
2. 
3. 

Remember why you started this journey!

Best wishes,
Past Me`,
            'reflection': `# Reflecting on Today

Dear Future Me,

Today I'm feeling:

Three things I'm grateful for:
1. 
2. 
3. 

What I hope will change by the time you read this:

Take care,
Past Me`,
            'letter': `Dear Future Me,

I hope this message finds you well. As I write this, I want to share some thoughts with you:

What's important to me right now:

What I'm excited about:

What I'm worried about:

My hopes for you:

With love,
Past Me`
        };

        // Handle template selection
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', function() {
                if (this.value && templates[this.value]) {
                    easyMDE.value(templates[this.value]);
                    messageInput.value = templates[this.value]; // Update textarea
                } else {
                    easyMDE.value('');
                    messageInput.value = ''; // Update textarea
                }
            });
        }

        // Handle form submission
        const form = document.getElementById('future-message-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Update textarea with current editor content
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