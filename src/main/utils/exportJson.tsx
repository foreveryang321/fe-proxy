export const exportJSON = (title: string, data: any) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
  const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  const reTitle = `${title}.${year}-${month}-${day}.json`;
  const dataStr = data ? JSON.stringify(data, null, 2) : '';
  // Chrome、Firefox
  return new Promise<void>(resolve => {
    const a = document.createElement('a');
    const blob = new Blob([dataStr], { type: 'application/json' });
    a.href = URL.createObjectURL(blob);
    a.download = reTitle;
    a.click();
    resolve();
  });
};
