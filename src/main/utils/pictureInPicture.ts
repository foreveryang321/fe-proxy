export const popupWindow = async ({ url }: { url: string }) => {
  if (!('documentPictureInPicture' in window)) {
    alert('你的浏览器当前不支持 documentPictureInPicture。你可以转到 chrome://flags/#document-picture-in-picture-api 来启用它。');
    return;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const pipWindow = await documentPictureInPicture.requestWindow({ width: 580, height: 680 });
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.className = 'fe-proxy-popup-iframe';
  iframe.style.setProperty('width', '100%');
  iframe.style.setProperty('height', '100%');
  iframe.style.setProperty('border', 'none');
  pipWindow.document.body.style.setProperty('margin', '0');
  pipWindow.document.body.append(iframe);
  return pipWindow;
};
