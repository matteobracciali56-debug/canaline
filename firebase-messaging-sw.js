importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCwiPrjm7ldPhUOG8gu0h5BCo9pdbmpcnw',
  authDomain: 'canaline-abb.firebaseapp.com',
  projectId: 'canaline-abb',
  storageBucket: 'canaline-abb.firebasestorage.app',
  messagingSenderId: '451265391439',
  appId: '1:451265391439:web:5e94bad1206c3b2e64333a'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.item_id ? 'riordino-' + payload.data.item_id : 'riordino',
    requireInteraction: true
  });
});
