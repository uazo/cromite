// Mock pop-under ad: counts every click that reaches the document.
window.popunders = 0;
document.addEventListener('click', () => { window.popunders++; }, true);
