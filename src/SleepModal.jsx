import ModalWindow from './ui/ModalWindow';

// Модалка сна в таверне. Намеренно тупая (вопрос + три кнопки): вся логика ночи
// живёт в TavernHubScreen — модалка лишь показывает выбор и гасит «Спать до
// утра», когда этой ночью ждёт обязательный гость. Вёрстка целиком в
// ModalWindow, здесь только тексты и обработчики (макет Figma 517:5425).

const SLEEP_MESSAGE = 'Отряд отправится спать, но кто то может прийти...';

const SleepModal = ({ onSleep, onListen, onCancel, sleepDisabled = false, sleepHint = '' }) => (
  <ModalWindow
    title="Ночь опускается на таверну"
    // Подсказка занимает место основного текста: отдельной строки под неё в
    // макете нет, а объяснение «почему нельзя спать» важнее общей фразы.
    message={sleepDisabled && sleepHint ? sleepHint : SLEEP_MESSAGE}
    onDismiss={onCancel}
    buttons={[
      {
        id: 'sleep',
        label: 'Спать до утра',
        onClick: onSleep,
        disabled: sleepDisabled,
        title: sleepDisabled ? sleepHint : 'Проспать ночь до рассвета',
      },
      {
        id: 'listen',
        label: 'Прислушаться',
        onClick: onListen,
        title: 'Дождаться ночи и встретить того, кто придёт',
      },
      {
        id: 'cancel',
        label: 'Отмена',
        kind: 'red',
        onClick: onCancel,
      },
    ]}
  />
);

export default SleepModal;
