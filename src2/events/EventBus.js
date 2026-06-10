class EventBus {
  constructor() {
    this.channels = new Map();
  }

  _getListeners(channel, event) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Map());
    }
    const eventsMap = this.channels.get(channel);

    if (!eventsMap.has(event)) {
      eventsMap.set(event, new Set());
    }
    return eventsMap.get(event);
  }

  on(channel, event, callback) {

    const listeners = this._getListeners(channel, event);
    listeners.add(callback);

    return () => this.off(channel, event, callback);
  }

  off(channel, event, callback) {

    if (this.channels.has(channel) && this.channels.get(channel).has(event)) {

      const listeners = this.channels.get(channel).get(event);
      listeners.delete(callback);

      if (listeners.size === 0) {
        this.channels.get(channel).delete(event);
      }
    }
  }

  once(channel, event, callback) {

    const unsubscribe = this.on(channel, event, (...args) => {

      unsubscribe();
      callback(...args);
    });
  }

  emit(channel, event, ...args) {
    if (this.channels.has(channel)) {
      const eventsMap = this.channels.get(channel);

      if (eventsMap.has(event)) {
        const callbacks = Array.from(eventsMap.get(event));
        callbacks.forEach((callback) => {
          try { callback(...args); }
          catch (error) { console.error(`[EventBus] Error in channel '${channel}', event '${event}':`, error); }
        });
      }

      if (event !== '*' && eventsMap.has('*')) {
        const allCallbacks = Array.from(eventsMap.get('*'));
        allCallbacks.forEach((callback) => {
          try { callback(event, ...args); }
          catch (error) { console.error(`[EventBus] Error in wildcard listener for channel '${channel}':`, error); }
        });
      }
    }
  }

  clear(channel, event) {

    if (channel && event) {

      if (this.channels.has(channel)) this.channels.get(channel).delete(event);

    } else if (channel) {

      this.channels.delete(channel);
    } else {

      this.channels.clear();
    }
  }

  getAvailableEvents() {
    const list = [];

    for (const [channelName, eventsMap] of this.channels.entries()) {
      for (const eventName of eventsMap.keys()) {
        if (eventName !== '*') {
          list.push({ channel: channelName, event: eventName });
        }
      }
    }
    return list;
  }
}

export const eventBus = new EventBus();