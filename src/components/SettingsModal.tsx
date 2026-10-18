import React, { useState } from 'react';
import { PCDStorageService, DEFAULT_GAS_WEBHOOK_URL } from '../services/storage';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  RefreshCw,
  FileSpreadsheet,
  Mail,
  ExternalLink,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [webhookUrl, setWebhookUrl] = useState(() => PCDStorageService.getGasWebhookUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    const cleanUrl = webhookUrl.trim() || DEFAULT_GAS_WEBHOOK_URL;
    PCDStorageService.setGasWebhookUrl(cleanUrl);
    setTestStatus('testing');
    setTestMsg('Verifying connection with Google Apps Script...');

    const res = await PCDStorageService.testGasWebhook(cleanUrl);
    if (res.success) {
      setTestStatus('success');
      setTestMsg(res.message);
      // Auto-pull students into database
      await PCDStorageService.syncStudentsFromGoogleSheet();
    } else {
      setTestStatus('error');
      setTestMsg(res.message);
    }
  };

  const handleResetToDefault = () => {
    setWebhookUrl(DEFAULT_GAS_WEBHOOK_URL);
    PCDStorageService.setGasWebhookUrl(DEFAULT_GAS_WEBHOOK_URL);
    setTestStatus('success');
    setTestMsg('Reset to permanent default webhook URL!');
  };

  const copyAppsScript = () => {
    const instructions = `https://script.google.com/macros/library/d/1lnIHMUvEwC0pA_QyZAVeBOV8buDt_OckMXlySVzxpeLs8CrAflm9RfrT/4`;
    navigator.clipboard.writeText(instructions);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-900" />
            <h2 className="text-base font-black text-neutral-900">
              Google Sheet Webhook & Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-[11px]">
              Permanent sync is active. The system automatically syncs with your Google Sheet on load and when marking attendance.
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neutral-700 block">
                Google Apps Script Web App URL:
              </label>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/library/d/... or .../exec"
              className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveAndTest}
              disabled={testStatus === 'testing'}
              className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              {testStatus === 'testing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{testStatus === 'testing' ? 'Testing...' : 'Save & Verify Webhook'}</span>
            </button>

            <button
              onClick={copyAppsScript}
              className="px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-1.5 min-h-[40px]"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{isCopied ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>

          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : testStatus === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {testStatus === 'testing' ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : testStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testMsg}</span>
            </div>
          )}

          {/* Quick Guide for Google Apps Script Web App Deployment */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-2 text-[11px] text-neutral-600">
            <div className="font-bold text-neutral-800 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Apps Script Deployment Notes:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-neutral-600">
              <li>In your master Google Spreadsheet, open <b>Extensions &gt; Apps Script</b>.</li>
              <li>Paste the code from <code className="font-mono bg-neutral-200 px-1 py-0.5 rounded">google-apps-script.js</code>.</li>
              <li>Click <b>Deploy &gt; New deployment</b> (or Manage deployments).</li>
              <li>Type: <b>Web app</b> | Execute as: <b>Me</b> | Who has access: <b>Anyone</b>.</li>
              <li>If you have a deployed Web App, you can also paste your <code className="font-mono bg-neutral-200 px-1 py-0.5 rounded">.../exec</code> URL here.</li>
            </ol>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-1.5 text-[11px] text-neutral-600">
            <div className="font-bold text-neutral-800 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-neutral-700" />
              <span>Automated Gmail Receipts:</span>
            </div>
            <p className="text-neutral-500">
              Every time attendance is marked, a verified confirmation email is automatically sent to the student's SSN email (<code className="font-mono text-neutral-700">@ssn.edu.in</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
