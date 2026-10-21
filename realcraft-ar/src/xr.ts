export interface ARSupport {
  supported: boolean;
  /** Arabic explanation shown to the player when AR is unavailable. */
  reason: string;
}

/** Real capability check: WebXR must exist AND the browser must report immersive-ar support. */
export async function detectAR(): Promise<ARSupport> {
  if (!window.isSecureContext) {
    return { supported: false, reason: 'الواقع المعزز يتطلب اتصال HTTPS آمنًا.' };
  }
  if (!('xr' in navigator) || !navigator.xr) {
    return {
      supported: false,
      reason:
        'متصفحك لا يدعم WebXR. الواقع المعزز يعمل على Chrome في أندرويد (مع خدمات Google Play للواقع المعزز). متصفح Safari على iPhone لا يدعم WebXR AR.',
    };
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-ar');
    if (ok) return { supported: true, reason: '' };
  } catch {
    // fall through
  }
  return {
    supported: false,
    reason: 'هذا الجهاز أو المتصفح لا يدعم جلسات الواقع المعزز (immersive-ar). يمكنك اللعب في الوضع ثلاثي الأبعاد العادي.',
  };
}

/** Translate WebXR / getUserMedia failures into a clear message. */
export function explainXRError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'تم رفض إذن الكاميرا. اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح ثم أعد المحاولة، أو العب بالوضع العادي.';
    case 'SecurityError':
      return 'المتصفح منع الجلسة لأسباب أمنية. تأكد من فتح الموقع عبر HTTPS وبشكل مباشر (ليس داخل إطار).';
    case 'NotSupportedError':
      return 'الجهاز لا يدعم ميزات الواقع المعزز المطلوبة (تتبع الأسطح). جرّب الوضع العادي.';
    case 'InvalidStateError':
      return 'تعذر بدء جلسة الواقع المعزز الآن. أغلق التطبيقات التي تستخدم الكاميرا وأعد المحاولة.';
    default:
      return 'تعذر بدء الواقع المعزز. يمكنك اللعب في الوضع العادي بدون كاميرا.';
  }
}
