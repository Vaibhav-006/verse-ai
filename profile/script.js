// Three.js Background Setup
const BACKEND_BASE = 'https://verse-ai.onrender.com';

// Require auth token on profile page
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        // Not logged in, redirect to login
        window.location.href = '../login.html';
        return;
    }

    // Load current profile from backend
    try {
        const res = await fetch(`${BACKEND_BASE}/api/profile/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            // Populate form fields
            if (data.name) document.getElementById('fullName').value = data.name;
            if (data.email) document.getElementById('email').value = data.email;
            if (document.getElementById('location')) document.getElementById('location').value = '';
            if (data.bio !== undefined) document.getElementById('bio').value = data.bio || '';
            // Heading and avatar
            if (data.name) document.getElementById('userName').textContent = data.name;
            if (data.avatar) document.getElementById('avatarImg').src = data.avatar;
        }
    } catch (e) {
        console.warn('Failed to load profile:', e);
    }
});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bgCanvas'),
    alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Create animated background particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 5;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.005,
    color: 0x00a8ff
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

camera.position.z = 2;

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += 0.001;
    particlesMesh.rotation.x += 0.001;
    renderer.render(scene, camera);
}
animate();

// GSAP Animations
gsap.registerPlugin(ScrollTrigger);

// Header Animation
gsap.to('.profile-header', {
    opacity: 1,
    y: 0,
    duration: 1,
    delay: 0.5
});

// Stats Cards Animation
gsap.to('.stat-card', {
    opacity: 1,
    y: 0,
    duration: 1,
    stagger: 0.2,
    delay: 0.8
});

// Profile Details Animation
gsap.to('.profile-details', {
    opacity: 1,
    y: 0,
    duration: 1,
    delay: 1.2
});

// Form Handling
// document.getElementById('profileForm').addEventListener('submit', async (e) => {
//     e.preventDefault();
    
//     const formData = {
//         fullName: document.getElementById('fullName').value,
//         email: document.getElementById('email').value,
//         location: document.getElementById('location').value,
//         bio: document.getElementById('bio').value,
//         emailNotif: document.getElementById('emailNotif').checked,
//         darkMode: document.getElementById('darkMode').checked
//     };

//     try {
//         const response = await fetch('/api/profile/update', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(formData)
//         });

//         if (response.ok) {
//             // Show success animation
//             gsap.to('.save-button', {
//                 backgroundColor: '#00ff00',
//                 duration: 0.3,
//                 yoyo: true,
//                 repeat: 1
//             });
//         }
//     } catch (error) {
//         console.error('Error updating profile:', error);
//     }
// });

// Avatar Upload Handling
document.querySelector('.profile-avatar-container').addEventListener('click', () => {
    document.getElementById('avatarUpload').click();
});

document.getElementById('avatarUpload').addEventListener('change', async (e) => {

    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            // Preview image
            document.getElementById('avatarImg').src = e.target.result;

            // Upload to server
            const formData = new FormData();
            formData.append('avatar', file);

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${BACKEND_BASE}/api/profile/avatar`, {
                    method: 'POST',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                    body: formData
                });

                const data = await response.json();
                
                // Show success or error notification
                const notification = document.getElementById('notification');
                const notificationMessage = notification ? notification.querySelector('.notification-message') : null;
                

                if (response.ok) {
                    if (notificationMessage) notificationMessage.textContent = 'Avatar uploaded successfully!';
                    notification.classList.remove('error');
                    notification.classList.add('show');
                    
                    // Show success animation
                    gsap.to('.profile-avatar', {
                        scale: 1.1,
                        duration: 0.3,
                        yoyo: true,
                        repeat: 1
                    });
                } else {
                    if (notificationMessage) notificationMessage.textContent = data.error || 'Error uploading avatar!';
                    notification.classList.add('error');
                    notification.classList.add('show');
                }

                // Automatically hide the notification after 5 seconds
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 5000);

            } catch (error) {
                console.error('Error uploading avatar:', error);

                // Show error notification
                const notification = document.getElementById('notification');
                const notificationMessage = notification ? notification.querySelector('.notification-message') : null;
                if (notificationMessage) notificationMessage.textContent = 'Error uploading avatar. Please try again.';
                notification.classList.add('error');
                notification.classList.add('show');

                // Automatically hide the notification after 5 seconds
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 5000);
            }
        };
        reader.readAsDataURL(file);
    }
});

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// document.getElementById('profileForm').addEventListener('submit', async (e) => {
//     e.preventDefault();
    
//     const formData = {
//         fullName: document.getElementById('fullName').value,
//         email: document.getElementById('email').value,
//         location: document.getElementById('location').value,
//         bio: document.getElementById('bio').value,
//         emailNotif: document.getElementById('emailNotif').checked,
//         darkMode: document.getElementById('darkMode').checked
//     };

//     try {
//         const response = await fetch('/api/profile/update', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(formData)
//         });

//         const data = await response.json();

//         // Show success notification
//         const notification = document.getElementById('notification');
//         const notificationMessage = document.getElementById('notificationMessage');

//         if (response.ok) {
//             notificationMessage.textContent = 'Profile updated successfully!';
//             notification.classList.remove('error');
//             notification.classList.add('show');
//             // Reset form or handle other actions as needed

//             // Show success animation
//             gsap.to('.save-button', {
//                 backgroundColor: '#00ff00',
//                 duration: 0.3,
//                 yoyo: true,
//                 repeat: 1
//             });
//         } else {
//             notificationMessage.textContent = data.error || 'Something went wrong!';
//             notification.classList.add('error');
//             notification.classList.add('show');
//         }

//         // Automatically hide the notification after a few seconds
//         setTimeout(() => {
//             notification.classList.remove('show');
//         }, 5000);

//     } catch (error) {
//         console.error('Error updating profile:', error);

//         // Show error notification
//         const notification = document.getElementById('notification');
//         const notificationMessage = document.getElementById('notificationMessage');
//         notificationMessage.textContent = 'Error updating profile. Please try again.';
//         notification.classList.add('error');
//         notification.classList.add('show');

//         // Automatically hide the notification after a few seconds
//         setTimeout(() => {
//             notification.classList.remove('show');
//         }, 5000);
//     }
// });

// Add this to your existing JavaScript

// Function to show notification
function showNotification(type, message) {
    const notification = document.getElementById('saveNotification');
    const icon = notification.querySelector('i');
    const messageText = notification.querySelector('.notification-message');

    // Update notification content based on type
    if (type === 'success') {
        notification.className = 'notification success';
        icon.className = 'fas fa-check-circle';
    } else {
        notification.className = 'notification error';
        icon.className = 'fas fa-times-circle';
    }

    messageText.textContent = message;

    // Animate notification
    gsap.timeline()
        .to(notification, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.7)"
        })
        .to(notification, {
            x: '150%',
            opacity: 0,
            duration: 0.5,
            delay: 3,
            ease: "power2.in"
        });
}

// Update form handling
// document.getElementById('profileForm').addEventListener('submit', async (e) => {
//     e.preventDefault();
    
//     const formData = {
//         fullName: document.getElementById('fullName').value,
//         email: document.getElementById('email').value,
//         location: document.getElementById('location').value,
//         bio: document.getElementById('bio').value,
//         // emailNotif: document.getElementById('emailNotif').checked,
//         // darkMode: document.getElementById('darkMode').checked
//     };

//     try {
//         const response = await fetch('/api/profile/update', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(formData)
//         });

//         const data = await response.json();

//         // Show success notification
//         const notification = document.getElementById('notification');
//         const notificationMessage = document.getElementById('notificationMessage');

//         if (response.ok) {
//             notificationMessage.textContent = 'Profile updated successfully!';
//             notification.classList.remove('error');
//             notification.classList.add('show');

//             // Redirect to the next page (e.g., "profile-overview.html" or any URL you want)
//             setTimeout(() => {
//                 window.location.href = 'profile.html';  // Replace this URL with the destination page
//             }, 2000); // Wait for 2 seconds before redirecting to show the success notification

//             // Show success animation for the save button
//             gsap.to('.save-button', {
//                 backgroundColor: '#00ff00',
//                 duration: 0.3,
//                 yoyo: true,
//                 repeat: 1
//             });
//         } else {
//             notificationMessage.textContent = data.error || 'Something went wrong!';
//             notification.classList.add('error');
//             notification.classList.add('show');
//         }

//         // Automatically hide the notification after a few seconds
//         setTimeout(() => {
//             notification.classList.remove('show');
//         }, 5000);

//     } catch (error) {
//         console.error('Error updating profile:', error);

//         // Show error notification
//         const notification = document.getElementById('notification');
//         const notificationMessage = document.getElementById('notificationMessage');
//         notificationMessage.textContent = 'Error updating profile. Please try again.';
//         notification.classList.add('error');
//         notification.classList.add('show');

//         // Automatically hide the notification after a few seconds
//         setTimeout(() => {
//             notification.classList.remove('show');
//         }, 5000);
//     }
// });


// Add ripple effect styles
const style = document.createElement('style');
style.textContent = `
    .save-button {
        position: relative;
        overflow: hidden;
    }
    .ripple {
        position: absolute;
        width: 20px;
        height: 20px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }
`;
document.head.appendChild(style);

// Add click animation to save button
document.querySelector('.save-button').addEventListener('click', (e) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    button.appendChild(ripple);

    gsap.to(ripple, {
        scale: 4,
        opacity: 0,
        duration: 0.6,
        onComplete: () => ripple.remove()
    });
});

// Add this function to your script.js
function goBack() {
    const transition = document.createElement('div');
    transition.className = 'page-transition';
    document.body.appendChild(transition);

    gsap.timeline()
        .to(transition, {
            scaleY: 1,
            duration: 0.5,
            ease: 'power2.inOut'
        })
        .to({}, {
            duration: 0.1,
            onComplete: () => {
                window.location.href = 'profile.html';
            }
        });
}

// Add these functions to your script.js

// Show notification function
function showNotification(type, message) {
    const notification = document.getElementById('notification');
    const messageElement = notification.querySelector('.notification-message');
    
    // Reset classes
    notification.classList.remove('success', 'error');
    
    // Set type and message
    notification.classList.add(type);
    messageElement.textContent = message;
    
    // Animate notification
    gsap.timeline()
        .to(notification, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.7)"
        })
        .to(notification, {
            x: '150%',
            opacity: 0,
            duration: 0.5,
            delay: 3,
            ease: "power2.in"
        });
}

// Validate form function
function validateForm(formData) {
    const errors = [];
    const requiredFields = ['fullName', 'email', 'location'];
    
    requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!formData[field] || formData[field].trim() === '') {
            errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
            input.classList.add('input-error');
            
            // Remove error class after animation
            setTimeout(() => {
                input.classList.remove('input-error');
            }, 500);
        }
    });

    // Email validation
    if (formData.email && !validateEmail(formData.email)) {
        errors.push('Please enter a valid email address');
        document.getElementById('email').classList.add('input-error');
    }

    return errors;
}

// Email validation function
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Update your form submission handler
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = e.target.querySelector('.save-button');
    
    // Get form data
    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        location: document.getElementById('location').value.trim(),
        bio: document.getElementById('bio').value.trim()
    };

    // Validate form
    const errors = validateForm(formData);
    
    if (errors.length > 0) {
        // Show error notification with first error
        showNotification('error', errors[0]);
        return;
    }

    // Add loading state
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${BACKEND_BASE}/api/profile/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                name: formData.fullName,
                email: formData.email,
                bio: formData.bio
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed to update');

        // Show success notification
        showNotification('success', 'Profile updated successfully!');

        // Redirect after success
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1200);

    } catch (error) {
        console.error('Error:', error);
        showNotification('error', error.message || 'Error saving changes. Please try again.');
    } finally {
        // Remove loading state
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
});

// Add required field indicators to your form labels
document.addEventListener('DOMContentLoaded', () => {
    const requiredFields = ['fullName', 'email', 'location'];
    requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!input) return;
        // Find the nearest label within the same form-group
        const formGroup = input.closest('.form-group');
        const label = formGroup ? formGroup.querySelector('label') : document.querySelector(`label[for="${field}"]`);
        if (label && !label.querySelector('.req')) {
            label.innerHTML = `${label.textContent} <span class="req" style="color:#ff5a5f">*</span>`;
        }
    });
});