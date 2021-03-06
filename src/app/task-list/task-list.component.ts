import {
  Component,
  ViewChild,
  OnDestroy,
  HostBinding,
  AfterViewInit,
  ViewEncapsulation,
} from '@angular/core';

import { Router } from '@angular/router';

import {
  FormGroup,
  FormBuilder,
  Validators
} from '@angular/forms';

import { Store } from '@ngrx/store';

import {
  Observable,
  Subject,
  Subscription
} from 'rxjs';

import { AutoComplete, ConfirmationService } from 'primeng/primeng';
import { v1 as uuidV1 } from 'uuid';

@Component({
  selector: 'task-list',
  styleUrls: [ './task-list.component.scss' ],
  templateUrl: './task-list.component.html',
  // encapsulation: ViewEncapsulation.None,
})
export class TaskListComponent implements AfterViewInit, OnDestroy {
  @HostBinding('id') private id = 'task-list-panel';

  public tasks: Task[] = [];
  public selectedTaskId: string;
  public taskDialogState: DialogState = { show: false, type: 'NEW' };

  private tasks$: Subscription;
  private selectedTask$: Subscription;
  private taskDialogState$: Subscription;

  public taskTypeSelected: TaskType;

  constructor(
    private confirmDialogService: ConfirmationService,
    private router: Router,
    private store: Store<RXState>,
    private fb: FormBuilder,
  ) {
    this.tasks$ = Observable.combineLatest(
      this.store.select<Task[]>('tasks'),
      this.store.select<TaskSchedule[]>('taskSchedules'),
      this.store.select<ListsState>('listsState'),
      this.filterTasks,
    )
      .subscribe((tasks) => {
        this.tasks = tasks;
      });

    this.selectedTask$ = this.store.select<ListsState>('listsState')
      .subscribe(({ selectedTask }) => {
        this.selectedTaskId = selectedTask;
      });
  }

  public ngAfterViewInit() {
    this.taskDialogState$ = this.store
      .select<DialogState>('taskDialogState')
      .subscribe((taskDialogState) =>
        this.taskDialogState = taskDialogState
      );
  }

  public ngOnDestroy() {
    this.tasks$ && this.tasks$.unsubscribe();
    this.selectedTask$ && this.selectedTask$.unsubscribe();
    this.taskDialogState$ && this.taskDialogState$.unsubscribe();
  }

  public onNgDrop(source: Task, target: Task) {
    if (source.id === target.id) return;
    const offset = source.order > target.order ? -0.5 : 0.5
    this.store.dispatch({
      type: 'UPDATE_TASK',
      payload: {
        ...source,
        order: target.order + offset,
      } as Task
    })
  }

  public filterTasks(
    tasks: Task[],
    taskSchedules: TaskSchedule[],
    { selectedFolder, selectedTaskSchedule }: ListsState
  ) {
    if (
      selectedFolder === '' &&
      selectedTaskSchedule === ''
    ) {
      return tasks;
    }

    const filteredTaskSchedulesIds = taskSchedules
      .filter((taskSchedule) =>
        taskSchedule.id !== '' &&
        // Filter by selectedScheduleList if any selected
        (
          selectedFolder === '' ||
          taskSchedule.folderId === selectedFolder
        ) &&
        // Filter by selectedScheduleList if any selected
        (
          selectedTaskSchedule === '' ||
          taskSchedule.id === selectedTaskSchedule
        )
      )
      .map(TaskSchedule => TaskSchedule.id);

    return tasks.filter((task) => filteredTaskSchedulesIds.includes(task.taskScheduleId));
  }

  public setSelectedTask(task: Task) {
    console.log('SetSelected: ', task);
    this.store.dispatch({
      type: 'SHOW_TASK',
      payload: task.id,
    });
  }

  public openTaskDialog(type: string) {
    switch (type) {
      case 'UPDATE':
        this.gotoTask({
          id: this.selectedTaskId,
          method: 'UPDATE',
        });
        break;

      case 'DELETE':
        if (this.selectedTaskId === '') return;

        const taskToDelete = this.tasks
          .find((task) => task.id === this.selectedTaskId)

        this.confirmDialogService.confirm({
          message: `¿Esta seguro que desea borrar la tarea seleccionada ${taskToDelete.name}?`,
          header: 'Confirmar borrado de tarea',
          icon: 'fa fa-trash',
          accept: () => {
            this.store.dispatch({
              type: 'DELETE_TASK',
              payload: taskToDelete,
            });
          },
        });
        break;

      case 'NEW':
      default:
        this.store.dispatch({
          type: 'SHOW_TASK_DIALOG',
        });
        break;
    }
  }

  public toggleTaskDialog(isShow: boolean) {
    this.store.dispatch({
      type: isShow ? 'SHOW_TASK_DIALOG' : 'HIDE_TASK_DIALOG',
    });
  }

  public newTask() {
    this.gotoTask({
      method: 'NEW',
      type: this.taskTypeSelected,
    })
  }

  public gotoTask({method, id, type}: {method: CrudMethod, id?: string, type?: TaskType}) {
    this.router.navigate(['/task', {
      method,
      type: type && JSON.stringify(type),
      id,
    }])
    this.toggleTaskDialog(false)
  }
}
