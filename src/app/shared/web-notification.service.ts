import { Injectable } from '@angular/core';

@Injectable()
export class WebNotificationService {

  private permission: string

  constructor() {
    this.createNotification({
      title: 'Notifications permission granted',
      duration: 3000,
    })
    .catch((error) => console.log('Notification error: ', error))
  }

  public async createNotification({
    title = 'Info',
    duration,
    ...options
  }: NotificationParams) {

    if (!('Notification' in window)) {
      throw new Error('Notification API not supported')
    }

    this.permission = await Notification.requestPermission()

    if (this.permission !== 'granted') {
      throw new Error('Permission status: ' + this.permission)
    }

    let notification = new Notification(title, options)

    if (duration) {
      setTimeout(() => notification.close(), duration)
    }
  }
  public async createErrorNotification({
    title = 'Error',
    icon = 'https://cdn0.iconfinder.com/data/icons/shift-free/32/Error-128.png',
    duration,
    ...options
  }: NotificationParams) {
    return this.createNotification({
      title,
      icon,
      duration,
      ...options,
    })
  }
}
