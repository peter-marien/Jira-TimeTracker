import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideCircleCheck, LucideExternalLink, LucideEye, LucideEyeOff, LucideKeyRound, LucidePalette, LucidePlug, LucideX } from '@lucide/angular';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import type { JiraConnection, OAuthFlowResult } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { ColorPicker } from '../shared/color-picker';

@Component({
    imports: [ReactiveFormsModule, MatDialogModule, ColorPicker, LucideCircleCheck, LucideExternalLink,
        LucideEye, LucideEyeOff, LucideKeyRound, LucidePalette, LucidePlug, LucideX],
    templateUrl: './jira-connection-dialog.html',
    styles: [`
        .legacy-connection-content { padding-top:6px !important; max-height:none; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class JiraConnectionDialog {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject<MatDialogRef<JiraConnectionDialog, boolean>>(MatDialogRef);
    protected readonly connection = inject<JiraConnection | null>(MAT_DIALOG_DATA);
    protected readonly form = inject(NonNullableFormBuilder).group({
        name: [this.connection?.name ?? '', Validators.required],
        type: this.connection?.auth_type ?? 'api_token' as 'api_token' | 'oauth',
        baseUrl: this.connection?.base_url ?? '',
        email: this.connection?.email ?? '',
        token: this.connection?.api_token ?? '',
        clientId: this.connection?.client_id ?? '',
        clientSecret: '',
        color: this.connection?.color || '',
        enabled: this.connection?.is_enabled !== 0,
        default: !!this.connection?.is_default
    });
    protected readonly authType = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });
    protected readonly status = signal<{ success: boolean; message: string } | null>(null);
    protected readonly operation = signal('');
    protected readonly busy = computed(() => !!this.operation());
    protected readonly showToken = signal(false);
    protected readonly showSecret = signal(false);
    protected readonly editAuthorization = signal(false);
    private readonly authorization = signal<OAuthFlowResult | null>(null);
    protected readonly authorized = computed(() => !!(this.authorization()?.cloudId || (this.connection?.auth_type === 'oauth' && this.connection.cloud_id)));
    protected readonly siteUrl = computed(() => this.authorization()?.siteUrl || (this.connection?.auth_type === 'oauth' ? this.connection.base_url : ''));

    protected async authorize(): Promise<void> {
        await this.run('authorize', async () => {
            const { clientId, clientSecret } = this.form.getRawValue();
            if (!clientId.trim() || (!clientSecret && this.connection?.auth_type !== 'oauth')) throw new Error('Enter your OAuth client ID and client secret.');
            const result = await this.api.startOAuthFlow(clientId.trim(), clientSecret, this.connection?.id);
            if (!result.success) throw new Error(result.error || 'Authorization failed.');
            this.authorization.set(result);
            this.editAuthorization.set(false);
            this.status.set({ success: true, message: 'Authorized with ' + (result.siteName || 'Jira') });
        });
    }

    protected async cancelAuthorization(): Promise<void> {
        try { await this.api.cancelOAuthFlow(); }
        catch (error) { this.status.set({ success: false, message: errorMessage(error) }); }
    }

    protected async openTokenPage(): Promise<void> {
        try { await this.api.openExternal('https://id.atlassian.com/manage-profile/security/api-tokens'); }
        catch (error) { this.status.set({ success: false, message: errorMessage(error) }); }
    }

    protected async openOAuthApp(): Promise<void> {
        try { await this.api.openExternal('https://developer.atlassian.com/console/myapps/'); }
        catch (error) { this.status.set({ success: false, message: errorMessage(error) }); }
    }

    protected async test(): Promise<void> {
        await this.run('test', async () => {
            const data = this.form.getRawValue();
            const result = data.type === 'oauth' && this.connection
                ? await this.api.testOAuthConnection(this.connection.id)
                : await this.api.testJiraConnection(this.apiTokenFields());
            if (!result.success) throw new Error(result.error || 'Connection test failed.');
            this.status.set({ success: true, message: 'Connected as ' + (result.displayName || 'the configured Jira user') });
        });
    }

    protected async save(): Promise<void> {
        await this.run('save', async () => {
            const value = this.form.getRawValue();
            if (!value.name.trim()) throw new Error('Enter a connection name.');
            const common = { id: this.connection?.id, name: value.name.trim(), color: value.color,
                is_enabled: Number(value.enabled), is_default: Number(value.default) };
            if (value.type === 'oauth') {
                const oauth = this.authorization();
                if (!this.authorized()) throw new Error('Authorize with Jira first.');
                if (!oauth && value.clientId !== this.connection?.client_id) throw new Error('Reauthorize before changing the OAuth client.');
                await this.api.saveJiraConnectionOAuth({
                    ...common, base_url: this.siteUrl(), auth_type: 'oauth', client_id: value.clientId,
                    cloud_id: oauth?.cloudId || this.connection?.cloud_id,
                    client_secret_encrypted: oauth?.clientSecretEncrypted, access_token_encrypted: oauth?.accessTokenEncrypted,
                    refresh_token_encrypted: oauth?.refreshTokenEncrypted,
                    token_expires_at: oauth?.expiresIn ? Math.floor(Date.now() / 1000) + oauth.expiresIn : this.connection?.token_expires_at
                });
            } else {
                const fields = this.apiTokenFields();
                await this.api.saveJiraConnectionOAuth({
                    ...common, auth_type: 'api_token', base_url: fields.baseUrl, email: fields.email, api_token: fields.apiToken
                });
            }
            this.dialog.close(true);
        });
    }

    private apiTokenFields() {
        const { baseUrl, email, token } = this.form.getRawValue();
        if (!/^https?:\/\//i.test(baseUrl.trim()) || !email.trim() || !token.trim()) throw new Error('Enter a valid base URL, email and API token.');
        return { baseUrl: baseUrl.trim(), email: email.trim(), apiToken: token.trim() };
    }

    private async run(operation: string, action: () => Promise<void>): Promise<void> {
        if (this.busy()) return;
        this.operation.set(operation);
        this.dialog.disableClose = true;
        this.status.set(null);
        try { await action(); }
        catch (error) { this.status.set({ success: false, message: errorMessage(error) }); }
        finally { this.operation.set(''); this.dialog.disableClose = false; }
    }
}
