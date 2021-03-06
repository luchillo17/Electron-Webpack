
import {
  Injectable,
  OnDestroy,
  Injector,
} from '@angular/core';

import { Store } from '@ngrx/store';
import { Observable, Subject, Subscription } from 'rxjs';

import { v1 as uuidV1 } from 'uuid';
import * as schedule from 'node-schedule';

import {
  UtilService,
  WebNotificationService,
  MailNotificationService,
} from './';

import { tasksTypes } from '../index';

@Injectable()
export class ScheduleService implements OnDestroy {
  public tasks$: Observable<Task[]>;

  public scheduleEmitter = new Subject<TaskSchedule>();
  public jobs: schedule.Job[] = [];

  private scheduleServiceSub: Subscription;
  constructor(
    public store: Store<RXState>,
    public injector: Injector,
    public notificationService: WebNotificationService,
    public mailNotificationService: MailNotificationService,
  ) {
    // Combine the result of all the observables into the last method.
    this.scheduleServiceSub = Observable.combineLatest(

      // Get scheduleLists, filter them by active and remove the 'Show all' one.
      this.store
        .select<Folder[]>('folders')
        .map(folders => folders.filter(folder => folder.id !== '' && folder.active))
        .map(folders => folders.map(folder => folder.id)),

      // Get taskSchedules, filter them by active and remove the 'Show all' one.
      this.store
        .select<TaskSchedule[]>('taskSchedules')
        .map((taskSchedules) => taskSchedules.filter((taskSchedule) => taskSchedule.id !== '' && taskSchedule.active)),

      // Filter all taskSchedules that are included in the actives scheduleLists
      (folderIds, taskSchedules) => {
        return taskSchedules.filter(taskSchedule => folderIds.includes(taskSchedule.folderId))
      }
    )
      .subscribe((taskSchedules) => {
        // Cancel all jobs, then schedule new ones with the filtered by combineLatest observable.
        this.cancelJobs();
        this.scheduleJobs(taskSchedules);
      })

    // Tasks observable
    this.tasks$ = this.store.select<Task[]>('tasks')

    // Execute taskSchedule using the 'executeTasks' method.
    this.scheduleEmitter.subscribe((taskSchedule) => {
      this.executeTasks(taskSchedule);
    });
  }
  public ngOnDestroy() {
    this.scheduleServiceSub && this.scheduleServiceSub.unsubscribe();
    this.cancelJobs();
  }
  private cancelJobs() {
    console.log('Cancelling jobs');
    this.jobs.forEach((job) => job.cancel());
  }

  // Schedule taskSchedules passed as param
  private scheduleJobs(taskSchedules: TaskSchedule[]) {
    console.log('Scheduling jobs');
    this.jobs = [
      ...taskSchedules.map((taskSchedule) => {
        // Extract recurrence rule from taskSchedule using Util method 'templateStringSingleLine'.
        const rule = UtilService.templateStringSingleLine(`
          ${taskSchedule.second || '*'}
          ${taskSchedule.minute || '*'}
          ${taskSchedule.hour || '*'}
          ${taskSchedule.dayOfMonth || '*'}
          ${taskSchedule.month || '*'}
          ${taskSchedule.dayOfWeek || '*'}
        `);
        const ruleObj = { rule } as schedule.RecurrenceSpecDateRange;

        // Add date range if defined in the taskSchedule
        if (taskSchedule.useDateRange) {
          Object.assign(ruleObj, {
            start: taskSchedule.start,
            end: taskSchedule.end,
          });
        }

        // Schedule job and emit event when it gets executed with callback
        return schedule.scheduleJob(taskSchedule.name, ruleObj, () => {
          this.scheduleEmitter.next(taskSchedule);
        })
      })
    ].filter(job => job);
  }

  /**
   * Execute active tasks associated to taskSchedule
   *
   * @param {TaskSchedule} taskSchedule taskSchedule to be executed.
   *
   * @memberOf ScheduleService
   */
  public async executeTasks(taskSchedule: TaskSchedule) {
    console.log('Executing TaskSchedule: ', taskSchedule.name);
    const tasks = await this.tasks$
      .map((tasksArr) =>
        tasksArr.filter(task =>
          task.taskScheduleId === taskSchedule.id
      ))
      .take(1)
      .toPromise()

    try {

      const taskData = [];
      for (const [taskIndex, task] of Array.from(tasks.entries())) {

        const taskType = tasksTypes.find(taskTypeItem => taskTypeItem.type === task.type.type)
        const taskExecutor = this.injector.get(taskType.executor)

        await taskExecutor.executeTask(task, taskData, taskIndex)
      }

      const executedAt = new Date()
      this.store.dispatch({
        type: 'SET_TASK_SCHEDULE_EXECUTED_AT',
        payload: {
          id: taskSchedule.id,
          executedAt,
        } as TaskScheduleExecutedAt,
      })
    } catch (error) {
      if (error === false) return;
      console.error('Error happened executing taskSchedule: ', taskSchedule, 'Error: ', error);
      this.notificationService.createErrorNotification({
        title: 'Error executing task schedule',
        body: `Task schedule: ${taskSchedule.name}\nError: ${JSON.stringify(error)}`,
        tag: 'ScheduleService-taskExecutor-error',
      })
      if (!taskSchedule.mailNotify) return;

      this.mailNotificationService.sendMail({
        to: taskSchedule.mailAddress,
        html: `
          Task schedule: ${ JSON.stringify(taskSchedule, null, 2) }<br>
          Error: ${error.message} ${JSON.stringify(error)}
        `,
      })
    }
  }
}
