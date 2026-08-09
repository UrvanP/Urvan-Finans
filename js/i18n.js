// Многоязычность. Тексты интерфейса живут здесь; пользовательские данные
// (имена, категории, комментарии) не переводятся — это не про них.

const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
];

const RTL_LANGS = ['he'];

const I18N = {
  ru: {
    app_title: 'Urvan Finance',
    categories_btn: 'Категории',
    privacy_hide_title: 'Скрыть суммы',
    privacy_show_title: 'Показать суммы',
    lang_btn_title: 'Язык',
    lang_picker_title: 'Выберите язык',
    tab_overview: 'Общий статус',
    subtab_bank: 'Банк счёт',
    section_checkpoints: 'История',

    overview_current_suffix: ' — текущий счёт',
    overview_cash_label: 'Общая наличность',
    overview_liquid_total: 'Ликвидные средства (счета + наличность)',
    overview_savings_total: 'Копилки и накопления',
    overview_cash_ops_title: 'Операции по общей наличности',
    add_transaction_btn: '+ Добавить операцию',

    member_current_prefix: 'Текущий счёт — ',
    section_operations: 'Операции',
    section_savings: 'Копилки',
    add_savings_btn: '+ Добавить копилку',

    empty_no_transactions: 'Пока нет операций.',
    empty_no_savings: 'Пока нет копилок.',
    empty_no_checkpoints: 'Пока нет чекапов.',
    empty_account_not_found: 'Счёт не найден.',
    empty_member_not_found: 'Член семьи не найден.',
    empty_no_categories: 'Пока нет категорий.',
    no_category_label: '(без категории)',

    savings_no_checkpoints_yet: 'Пока нет чекапов',
    savings_since: 'с ',
    savings_checkpoint_from: 'чекап от ',

    edit_title: 'Редактировать',
    delete_title: 'Удалить',
    save_name_title: 'Сохранить имя',

    tx_modal_edit_title: 'Редактировать операцию',
    tx_modal_new_title: 'Новая операция',
    field_type: 'Тип операции',
    type_expense: 'Расход',
    type_income: 'Доход',
    field_category: 'Категория',
    no_category_option: '— без категории —',
    field_amount: 'Сумма, ₪',
    field_date: 'Дата',
    field_comment: 'Комментарий',
    field_comment_optional: 'Комментарий (необязательно)',
    btn_cancel: 'Отмена',
    btn_save: 'Сохранить',
    err_amount_positive: 'Введите сумму больше нуля.',
    err_date_required: 'Укажите дату.',
    err_tx_save_failed: 'Не удалось сохранить операцию: ',

    savings_new_title: 'Новая копилка',
    field_name: 'Название',
    name_placeholder_example: 'Например, Пенсия',
    field_current_amount: 'Текущая сумма, ₪',
    btn_create: 'Создать',
    err_savings_name_required: 'Введите название копилки.',
    err_amount_required: 'Введите текущую сумму.',
    err_savings_create_failed: 'Не удалось создать копилку: ',

    savings_rename_title: 'Переименовать копилку',
    err_name_empty: 'Название не может быть пустым.',
    err_savings_rename_failed: 'Не удалось переименовать копилку: ',

    confirm_delete_savings: 'Удалить копилку? Вся история чекапов тоже удалится.',
    confirm_delete_transaction: 'Удалить операцию?',
    confirm_delete_checkpoint: 'Удалить этот чекап?',
    confirm_delete_category: 'Удалить категорию? У операций с этой категорией она станет пустой.',

    btn_close: 'Закрыть',
    add_checkpoint_btn: '+ Добавить чекап',
    checkpoint_start: 'начало отсчёта',
    checkpoint_edit_title: 'Редактировать чекап',
    checkpoint_new_title: 'Новый чекап',
    field_balance: 'Баланс, ₪',
    err_checkpoint_save_failed: 'Не удалось сохранить чекап: ',

    categories_modal_title: 'Категории',
    categories_income_group: 'Доходы',
    categories_expense_group: 'Расходы',
    add_category_title: 'Добавить категорию',
    field_type_simple: 'Тип',
    btn_add: 'Добавить',
    err_category_name_required: 'Введите название категории.',
    err_category_add_failed: 'Не удалось добавить категорию: ',
    err_category_rename_failed: 'Не удалось переименовать категорию: ',
    err_category_delete_failed: 'Не удалось удалить категорию: ',

    setup_needed_html: 'Нужно указать данные подключения к Supabase.<br>Откройте файл <code>js/config.js</code> и впишите туда ваш <b>Project URL</b> и <b>anon public key</b> (в Supabase: Project Settings → API), затем обновите страницу.',
    load_error_html: 'Не удалось загрузить данные из Supabase.<br>Проверьте <code>js/config.js</code> и что в Supabase выполнены скрипты <code>sql/schema.sql</code> и <code>sql/migration_2_checkpoints.sql</code>.<br>',
  },

  uk: {
    app_title: 'Urvan Finance',
    categories_btn: 'Категорії',
    privacy_hide_title: 'Приховати суми',
    privacy_show_title: 'Показати суми',
    lang_btn_title: 'Мова',
    lang_picker_title: 'Оберіть мову',
    tab_overview: 'Загальний стан',
    subtab_bank: 'Банківський рахунок',
    section_checkpoints: 'Історія',

    overview_current_suffix: ' — поточний рахунок',
    overview_cash_label: 'Загальна готівка',
    overview_liquid_total: 'Ліквідні кошти (рахунки + готівка)',
    overview_savings_total: 'Скарбнички та накопичення',
    overview_cash_ops_title: 'Операції із загальною готівкою',
    add_transaction_btn: '+ Додати операцію',

    member_current_prefix: 'Поточний рахунок — ',
    section_operations: 'Операції',
    section_savings: 'Скарбнички',
    add_savings_btn: '+ Додати скарбничку',

    empty_no_transactions: 'Поки що немає операцій.',
    empty_no_savings: 'Поки що немає скарбничок.',
    empty_no_checkpoints: 'Поки що немає чекапів.',
    empty_account_not_found: 'Рахунок не знайдено.',
    empty_member_not_found: "Члена сім'ї не знайдено.",
    empty_no_categories: 'Поки що немає категорій.',
    no_category_label: '(без категорії)',

    savings_no_checkpoints_yet: 'Поки що немає чекапів',
    savings_since: 'з ',
    savings_checkpoint_from: 'чекап від ',

    edit_title: 'Редагувати',
    delete_title: 'Видалити',
    save_name_title: 'Зберегти назву',

    tx_modal_edit_title: 'Редагувати операцію',
    tx_modal_new_title: 'Нова операція',
    field_type: 'Тип операції',
    type_expense: 'Витрата',
    type_income: 'Дохід',
    field_category: 'Категорія',
    no_category_option: '— без категорії —',
    field_amount: 'Сума, ₪',
    field_date: 'Дата',
    field_comment: 'Коментар',
    field_comment_optional: "Коментар (необов'язково)",
    btn_cancel: 'Скасувати',
    btn_save: 'Зберегти',
    err_amount_positive: 'Введіть суму більшу за нуль.',
    err_date_required: 'Вкажіть дату.',
    err_tx_save_failed: 'Не вдалося зберегти операцію: ',

    savings_new_title: 'Нова скарбничка',
    field_name: 'Назва',
    name_placeholder_example: 'Наприклад, Пенсія',
    field_current_amount: 'Поточна сума, ₪',
    btn_create: 'Створити',
    err_savings_name_required: 'Введіть назву скарбнички.',
    err_amount_required: 'Введіть поточну суму.',
    err_savings_create_failed: 'Не вдалося створити скарбничку: ',

    savings_rename_title: 'Перейменувати скарбничку',
    err_name_empty: 'Назва не може бути порожньою.',
    err_savings_rename_failed: 'Не вдалося перейменувати скарбничку: ',

    confirm_delete_savings: 'Видалити скарбничку? Уся історія чекапів теж видалиться.',
    confirm_delete_transaction: 'Видалити операцію?',
    confirm_delete_checkpoint: 'Видалити цей чекап?',
    confirm_delete_category: 'Видалити категорію? В операціях із цією категорією вона стане порожньою.',

    btn_close: 'Закрити',
    add_checkpoint_btn: '+ Додати чекап',
    checkpoint_start: 'початок відліку',
    checkpoint_edit_title: 'Редагувати чекап',
    checkpoint_new_title: 'Новий чекап',
    field_balance: 'Баланс, ₪',
    err_checkpoint_save_failed: 'Не вдалося зберегти чекап: ',

    categories_modal_title: 'Категорії',
    categories_income_group: 'Доходи',
    categories_expense_group: 'Витрати',
    add_category_title: 'Додати категорію',
    field_type_simple: 'Тип',
    btn_add: 'Додати',
    err_category_name_required: 'Введіть назву категорії.',
    err_category_add_failed: 'Не вдалося додати категорію: ',
    err_category_rename_failed: 'Не вдалося перейменувати категорію: ',
    err_category_delete_failed: 'Не вдалося видалити категорію: ',

    setup_needed_html: 'Потрібно вказати дані підключення до Supabase.<br>Відкрийте файл <code>js/config.js</code> і впишіть туди ваш <b>Project URL</b> і <b>anon public key</b> (у Supabase: Project Settings → API), потім оновіть сторінку.',
    load_error_html: 'Не вдалося завантажити дані з Supabase.<br>Перевірте <code>js/config.js</code> і що в Supabase виконані скрипти <code>sql/schema.sql</code> та <code>sql/migration_2_checkpoints.sql</code>.<br>',
  },

  he: {
    app_title: 'Urvan Finance',
    categories_btn: 'קטגוריות',
    privacy_hide_title: 'הסתר סכומים',
    privacy_show_title: 'הצג סכומים',
    lang_btn_title: 'שפה',
    lang_picker_title: 'בחר שפה',
    tab_overview: 'מצב כללי',
    subtab_bank: 'חשבון בנק',
    section_checkpoints: 'היסטוריה',

    overview_current_suffix: ' — חשבון עו״ש',
    overview_cash_label: 'מזומן משותף',
    overview_liquid_total: 'כסף נזיל (חשבונות + מזומן)',
    overview_savings_total: 'קופות חיסכון וצבירה',
    overview_cash_ops_title: 'פעולות במזומן המשותף',
    add_transaction_btn: '+ הוסף פעולה',

    member_current_prefix: 'חשבון עו״ש — ',
    section_operations: 'פעולות',
    section_savings: 'קופות חיסכון',
    add_savings_btn: '+ הוסף קופת חיסכון',

    empty_no_transactions: 'עדיין אין פעולות.',
    empty_no_savings: 'עדיין אין קופות חיסכון.',
    empty_no_checkpoints: 'עדיין אין בדיקות.',
    empty_account_not_found: 'החשבון לא נמצא.',
    empty_member_not_found: 'בן/בת המשפחה לא נמצאו.',
    empty_no_categories: 'עדיין אין קטגוריות.',
    no_category_label: '(ללא קטגוריה)',

    savings_no_checkpoints_yet: 'עדיין אין בדיקות',
    savings_since: 'מאז ',
    savings_checkpoint_from: 'בדיקה מ־',

    edit_title: 'עריכה',
    delete_title: 'מחיקה',
    save_name_title: 'שמור שם',

    tx_modal_edit_title: 'עריכת פעולה',
    tx_modal_new_title: 'פעולה חדשה',
    field_type: 'סוג פעולה',
    type_expense: 'הוצאה',
    type_income: 'הכנסה',
    field_category: 'קטגוריה',
    no_category_option: '— ללא קטגוריה —',
    field_amount: 'סכום, ₪',
    field_date: 'תאריך',
    field_comment: 'הערה',
    field_comment_optional: 'הערה (לא חובה)',
    btn_cancel: 'ביטול',
    btn_save: 'שמירה',
    err_amount_positive: 'הזן סכום גדול מאפס.',
    err_date_required: 'בחר תאריך.',
    err_tx_save_failed: 'שמירת הפעולה נכשלה: ',

    savings_new_title: 'קופת חיסכון חדשה',
    field_name: 'שם',
    name_placeholder_example: 'לדוגמה, פנסיה',
    field_current_amount: 'סכום נוכחי, ₪',
    btn_create: 'יצירה',
    err_savings_name_required: 'הזן שם לקופת החיסכון.',
    err_amount_required: 'הזן את הסכום הנוכחי.',
    err_savings_create_failed: 'יצירת קופת החיסכון נכשלה: ',

    savings_rename_title: 'שינוי שם לקופת החיסכון',
    err_name_empty: 'השם לא יכול להיות ריק.',
    err_savings_rename_failed: 'שינוי השם נכשל: ',

    confirm_delete_savings: 'למחוק את קופת החיסכון? כל היסטוריית הבדיקות תימחק גם היא.',
    confirm_delete_transaction: 'למחוק את הפעולה?',
    confirm_delete_checkpoint: 'למחוק את הבדיקה הזו?',
    confirm_delete_category: 'למחוק את הקטגוריה? בפעולות עם קטגוריה זו היא תוצג כריקה.',

    btn_close: 'סגירה',
    add_checkpoint_btn: '+ הוסף בדיקה',
    checkpoint_start: 'תחילת המעקב',
    checkpoint_edit_title: 'עריכת בדיקה',
    checkpoint_new_title: 'בדיקה חדשה',
    field_balance: 'יתרה, ₪',
    err_checkpoint_save_failed: 'שמירת הבדיקה נכשלה: ',

    categories_modal_title: 'קטגוריות',
    categories_income_group: 'הכנסות',
    categories_expense_group: 'הוצאות',
    add_category_title: 'הוספת קטגוריה',
    field_type_simple: 'סוג',
    btn_add: 'הוספה',
    err_category_name_required: 'הזן שם לקטגוריה.',
    err_category_add_failed: 'הוספת הקטגוריה נכשלה: ',
    err_category_rename_failed: 'שינוי שם הקטגוריה נכשל: ',
    err_category_delete_failed: 'מחיקת הקטגוריה נכשלה: ',

    setup_needed_html: 'יש להזין פרטי התחברות ל-Supabase.<br>פתח את הקובץ <code>js/config.js</code> והזן שם את ה-<b>Project URL</b> וה-<b>anon public key</b> שלך (ב-Supabase: Project Settings → API), ואז רענן את העמוד.',
    load_error_html: 'טעינת הנתונים מ-Supabase נכשלה.<br>בדוק את <code>js/config.js</code> ושבצענו את הסקריפטים <code>sql/schema.sql</code> ו-<code>sql/migration_2_checkpoints.sql</code> ב-Supabase.<br>',
  },

  en: {
    app_title: 'Urvan Finance',
    categories_btn: 'Categories',
    privacy_hide_title: 'Hide amounts',
    privacy_show_title: 'Show amounts',
    lang_btn_title: 'Language',
    lang_picker_title: 'Choose a language',
    tab_overview: 'Overview',
    subtab_bank: 'Bank account',
    section_checkpoints: 'History',

    overview_current_suffix: ' — current account',
    overview_cash_label: 'Shared cash',
    overview_liquid_total: 'Liquid funds (accounts + cash)',
    overview_savings_total: 'Savings & pensions',
    overview_cash_ops_title: 'Shared cash transactions',
    add_transaction_btn: '+ Add transaction',

    member_current_prefix: 'Current account — ',
    section_operations: 'Transactions',
    section_savings: 'Savings',
    add_savings_btn: '+ Add savings account',

    empty_no_transactions: 'No transactions yet.',
    empty_no_savings: 'No savings accounts yet.',
    empty_no_checkpoints: 'No checkpoints yet.',
    empty_account_not_found: 'Account not found.',
    empty_member_not_found: 'Family member not found.',
    empty_no_categories: 'No categories yet.',
    no_category_label: '(no category)',

    savings_no_checkpoints_yet: 'No checkpoints yet',
    savings_since: 'since ',
    savings_checkpoint_from: 'checkpoint from ',

    edit_title: 'Edit',
    delete_title: 'Delete',
    save_name_title: 'Save name',

    tx_modal_edit_title: 'Edit transaction',
    tx_modal_new_title: 'New transaction',
    field_type: 'Transaction type',
    type_expense: 'Expense',
    type_income: 'Income',
    field_category: 'Category',
    no_category_option: '— no category —',
    field_amount: 'Amount, ₪',
    field_date: 'Date',
    field_comment: 'Comment',
    field_comment_optional: 'Comment (optional)',
    btn_cancel: 'Cancel',
    btn_save: 'Save',
    err_amount_positive: 'Enter an amount greater than zero.',
    err_date_required: 'Please pick a date.',
    err_tx_save_failed: 'Failed to save transaction: ',

    savings_new_title: 'New savings account',
    field_name: 'Name',
    name_placeholder_example: 'e.g. Pension',
    field_current_amount: 'Current amount, ₪',
    btn_create: 'Create',
    err_savings_name_required: 'Enter a name for the savings account.',
    err_amount_required: 'Enter the current amount.',
    err_savings_create_failed: 'Failed to create savings account: ',

    savings_rename_title: 'Rename savings account',
    err_name_empty: 'Name cannot be empty.',
    err_savings_rename_failed: 'Failed to rename savings account: ',

    confirm_delete_savings: 'Delete this savings account? Its whole checkpoint history will be deleted too.',
    confirm_delete_transaction: 'Delete this transaction?',
    confirm_delete_checkpoint: 'Delete this checkpoint?',
    confirm_delete_category: 'Delete this category? Transactions using it will show no category.',

    btn_close: 'Close',
    add_checkpoint_btn: '+ Add checkpoint',
    checkpoint_start: 'starting point',
    checkpoint_edit_title: 'Edit checkpoint',
    checkpoint_new_title: 'New checkpoint',
    field_balance: 'Balance, ₪',
    err_checkpoint_save_failed: 'Failed to save checkpoint: ',

    categories_modal_title: 'Categories',
    categories_income_group: 'Income',
    categories_expense_group: 'Expenses',
    add_category_title: 'Add category',
    field_type_simple: 'Type',
    btn_add: 'Add',
    err_category_name_required: 'Enter a category name.',
    err_category_add_failed: 'Failed to add category: ',
    err_category_rename_failed: 'Failed to rename category: ',
    err_category_delete_failed: 'Failed to delete category: ',

    setup_needed_html: 'Supabase connection details are missing.<br>Open <code>js/config.js</code> and fill in your <b>Project URL</b> and <b>anon public key</b> (in Supabase: Project Settings → API), then refresh the page.',
    load_error_html: 'Could not load data from Supabase.<br>Check <code>js/config.js</code> and make sure <code>sql/schema.sql</code> and <code>sql/migration_2_checkpoints.sql</code> were run in Supabase.<br>',
  },
};

function getLang() {
  const saved = localStorage.getItem('lang');
  if (saved && I18N[saved]) return saved;
  return 'ru';
}

function setLang(code) {
  if (!I18N[code]) return;
  localStorage.setItem('lang', code);
  document.documentElement.lang = code;
  document.documentElement.dir = RTL_LANGS.includes(code) ? 'rtl' : 'ltr';
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.ru[key] || key;
}
