self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existingClient) {
        return existingClient.focus().then(() => existingClient.navigate('/trip/itinerary'));
      }
      return self.clients.openWindow('/trip/itinerary');
    })
  );
});
