import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

const stepsConfig = [
  {
    key: 'business',
    title: 'Set up your business profile',
    description: 'Add your business name and basic info so your blasts look professional.'
  },
  {
    key: 'twilio',
    title: 'Connect your Twilio numbers',
    description: 'Add your Twilio SID, Auth Token, and select which numbers to rotate.'
  },
  {
    key: 'voicemail',
    title: 'Upload your voicemail audio',
    description: 'Upload and preview the voicemail audio that will be dropped for leads.'
  },
  {
    key: 'campaign',
    title: 'Create your first campaign',
    description: 'Name your campaign and define the caller ID / settings.'
  },
  {
    key: 'leads',
    title: 'Upload your leads list',
    description: 'Import a CSV of leads with phone numbers to target.'
  },
  {
    key: 'blast',
    title: 'Run your first blast',
    description: 'Start a small test blast to confirm everything works end-to-end.'
  }
];

export default function OnboardingPage() {
  const { onboarding, refreshOnboarding } = useAuth();

  const handleCompleteStep = async (stepKey) => {
    try {
      const res = await fetch('/onboarding/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: stepKey })
      });
      if (!res.ok) {
        console.error('Failed to complete step', stepKey);
        return;
      }
      await refreshOnboarding();
    } catch (err) {
      console.error('Error completing step', stepKey, err);
    }
  };

  const completedMap = onboarding.steps || {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Welcome to BusyLine Voicemail Blaster</h1>
        <p className="mt-1 text-sm text-slate-400">
          Follow these quick steps to drop your first voicemail campaign. You can come back to this checklist anytime.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-2">Setup checklist</h2>
        <div className="space-y-3">
          {stepsConfig.map(step => {
            const done = !!completedMap[step.key];
            return (
              <div
                key={step.key}
                className="flex items-start justify-between rounded-md bg-slate-900/80 px-3 py-3 border border-slate-800"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-100">
                    {done ? '✅ ' : '⬜ '} {step.title}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {step.description}
                  </span>
                </div>
                <div className="ml-4 flex flex-col items-end gap-1">
                  {!done && (
                    <button
                      type="button"
                      onClick={() => handleCompleteStep(step.key)}
                      className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

