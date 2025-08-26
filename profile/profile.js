// Backend base URL
const BACKEND_BASE = 'https://verse-ai.onrender.com';

// Initialize Three.js background
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bgCanvas'),
    alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

// Initial Animations
const tl = gsap.timeline();

tl.from('.sidebar', {
    x: -100,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
})
.from('.main-content', {
    y: 50,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
}, '-=0.5')
.from('.right-sidebar', {
    x: 100,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
}, '-=0.5')
.from('.stat-card', {
    y: 30,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out'
}, '-=0.5');

// Default placeholder data (stats/activities can be wired later)
const userData = {
    name: 'John Doe',
    role: 'Premium Member',
    stats: { chats: 247, hours: 42, rating: 4.8 },
    activities: [
        { type: 'chat', title: 'AI Chat Session', time: '2 hours ago' },
        { type: 'achievement', title: 'Reached 200+ chats', time: '1 day ago' }
    ]
};

// Load actual user profile from backend
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        // If not logged in, redirect to home/login
        window.location.href = '../index.html';
        return;
    }
    try {
        const res = await fetch(`${BACKEND_BASE}/api/profile/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            // Update UI
            if (data.name) {
                userData.name = data.name;
                const nameEl = document.getElementById('userName');
                if (nameEl) nameEl.textContent = data.name;
            }
            if (data.avatar) {
                const avatarEl = document.getElementById('userAvatar');
                if (avatarEl) avatarEl.src = data.avatar;
            }
            // Optionally update role from backend in future
        }
    } catch (err) {
        console.warn('Failed to fetch profile for overview:', err);
    }
});

// Animate stats counting
gsap.to('#chatCount', {
    innerText: userData.stats.chats,
    duration: 2,
    snap: { innerText: 1 }
});

gsap.to('#hoursCount', {
    innerText: userData.stats.hours,
    duration: 2,
    snap: { innerText: 1 }
});

gsap.to('#ratingScore', {
    innerText: userData.stats.rating,
    duration: 2,
    snap: { innerText: 0.1 }
});

// Create activity timeline
function createActivityTimeline() {
    const timeline = document.getElementById('activityTimeline');
    userData.activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas fa-${activity.type === 'chat' ? 'comments' : 'trophy'}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.time}</p>
            </div>
        `;
        timeline.appendChild(activityItem);

        // Animate activity items
        gsap.from(activityItem, {
            x: -50,
            opacity: 0,
            duration: 0.8,
            scrollTrigger: {
                trigger: activityItem,
                start: 'top bottom',
                end: 'top center',
                toggleActions: 'play none none reverse'
            }
        });
    });
}

// Initialize activity timeline
createActivityTimeline();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Navigation interaction
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.sidebar-nav a.active').classList.remove('active');
        link.classList.add('active');
        
        // Animate content change
        gsap.to('.main-content', {
            opacity: 0,
            y: 20,
            duration: 0.3,
            onComplete: () => {
                // Here you would update the content
                gsap.to('.main-content', {
                    opacity: 1,
                    y: 0,
                    duration: 0.3
                });
            }
        });
    });
});

// Add this to your existing profile.js

// Handle edit profile link click with animation
document.querySelector('.edit-profile-link').addEventListener('click', function(e) {
    e.preventDefault();
    
    // Create transition overlay
    const transition = document.createElement('div');
    transition.className = 'page-transition';
    document.body.appendChild(transition);

    // Animate transition
    gsap.timeline()
        .to(transition, {
            scaleY: 1,
            duration: 0.5,
            ease: 'power2.inOut'
        })
        .to({}, {
            duration: 0.1,
            onComplete: () => {
                // Store current profile data in localStorage before redirecting
                const currentProfileData = {
                    name: document.getElementById('userName').textContent,
                    role: document.getElementById('userRole').textContent,
                    avatar: document.getElementById('userAvatar').src,
                    // Add any other data you want to persist
                };
                localStorage.setItem('currentProfileData', JSON.stringify(currentProfileData));
                
                // Redirect to edit profile page
                window.location.href = 'index.html';
            }
        });
});
