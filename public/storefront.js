// Progressive enhancements; navigation, filtering and checkout work without JS.
document.querySelectorAll('.product-form').forEach((form) => {
  const status = form.querySelector('.stock-note');
  form.addEventListener('change', (event) => {
    if (event.target.name === 'size') {
      status.textContent = `${event.target.value} 號 · 現貨 ${event.target.dataset.stock} 件`;
      status.classList.add('available');
    }
  });
});

document
  .querySelectorAll('form[action="/checkout/complete"]')
  .forEach((form) => {
    form.addEventListener('submit', () => {
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = '正在處理測試付款…';
    });
  });

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});
