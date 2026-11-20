import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { TimeSlice } from '@/lib/api';
import { DESKTOP_API, Feedback } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { confirm } from '../shared/confirm-dialog';
import { WorkItemEditor, type WorkItemEditorData } from '../work-items/work-item-editor';
import { TimeSliceEditor, type TimeSliceEditorData } from './time-slice-editor';
import type { SliceCommand } from './time-slice-table';

@Injectable({ providedIn: 'root' })
export class TimeSliceActions {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly tracking = inject(TrackingService);
    private readonly feedback = inject(Feedback);

    async editor(data: TimeSliceEditorData): Promise<boolean> {
        return !!await firstValueFrom(this.dialog.open<TimeSliceEditor, TimeSliceEditorData, boolean>(TimeSliceEditor, {
            data, width: { add: '500px', edit: '600px', copy: '425px', move: '425px', split: '600px' }[data.mode],
            maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh'
        }).afterClosed());
    }

    async run({ action, slice }: SliceCommand): Promise<boolean> {
        try {
            switch (action) {
                case 'delete':
                    if (!await confirm(this.dialog, { title: 'Delete Time Slice?', message: 'This action cannot be undone.', action: 'Delete', destructive: true })) return false;
                    await this.api.deleteTimeSlice(slice.id);
                    return true;
                case 'stop':
                    await this.tracking.stop();
                    return true;
                case 'resume': {
                    const item = await this.api.getWorkItem(slice.work_item_id);
                    await this.tracking.start(item);
                    return true;
                }
                case 'workItem': {
                    const item = await this.api.getWorkItem(slice.work_item_id);
                    return !!await firstValueFrom(this.dialog.open(WorkItemEditor, { data: { item } satisfies WorkItemEditorData, width: '425px' }).afterClosed());
                }
                case 'jira':
                    await this.openJira(slice);
                    return false;
                default:
                    return await this.editor({ mode: action, slice });
            }
        } catch (error) {
            this.feedback.error(error);
            return false;
        }
    }

    private async openJira(slice: TimeSlice): Promise<void> {
        const connection = (await this.api.getJiraConnections()).find(item => item.id === slice.jira_connection_id);
        if (connection && slice.jira_key) await this.api.openExternal(new URL('browse/' + encodeURIComponent(slice.jira_key), connection.base_url.replace(/\/$/, '') + '/').href);
    }
}
