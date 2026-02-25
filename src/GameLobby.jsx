import React, { useState, useEffect } from 'react';
import useGameStore, { BUDGET_CONFIG } from '../store/gameStore';
import './GameLobby.css';

const GameLobby = () => {
  const { setTeam } = useGameStore();

  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(1);
  const [teamMembers, setTeamMembers] = useState([{ name: '', role: 'Геолог' }]);
  const [experienceLevel, setExperienceLevel] = useState('student');

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  const getBudgetForLevel = (level) => {
    return level === 'student' ? BUDGET_CONFIG.STUDENT : BUDGET_CONFIG.PROFESSIONAL;
  };

  useEffect(() => {
    if (isMultiplayer && !sessionCode) {
      generateSessionCode();
    }
  }, [isMultiplayer]);

  const handleTeamSizeChange = (size) => {
    setTeamSize(size);
    const newTeam = Array.from({ length: size }, (_, i) =>
      teamMembers[i] ? teamMembers[i] : { name: '', role: 'Геолог' }
    );
    setTeamMembers(newTeam);
  };

  const updateTeamMember = (index, field, value) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleExperienceChange = (level) => setExperienceLevel(level);

  const generateSessionCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionCode(code);
    return code;
  };

  const handleGameModeToggle = (multiplayer) => {
    setIsMultiplayer(multiplayer);
    if (multiplayer && !sessionCode) {
      setTimeout(() => generateSessionCode(), 0);
    }
  };

  const handleSaveTeam = () => {
    const payload = {
      name: teamName.trim(),
      experienceLevel,
      members: teamMembers.map(m => ({ name: m.name.trim(), role: m.role })),
      createdAt: new Date().toISOString(),
      isMultiplayer,
      sessionCode: isMultiplayer ? sessionCode.trim().toUpperCase() : null,
    };
    setTeam(payload);

    if (isMultiplayer && sessionCode) {
      console.log('[Multiplayer] Создание/подключение к сессии:', sessionCode);
    }

  };

  const canProceed =
    teamName.trim() !== '' &&
    teamMembers.every(m => m.name.trim() !== '') &&
    (!isMultiplayer || sessionCode.trim() !== '');

  const currentBudget = getBudgetForLevel(experienceLevel);

  return (
    <div className="game-lobby">
      <header className="lobby-header">
        <h1>🛢️ Геологоразведочная игра</h1>
        <p className="subtitle">Лобби игры</p>
      </header>

      <main className="lobby-content">
        <div className="setup-container">
          <h2>Создание команды</h2>

          <div className="game-mode-selector">
            <label>Режим игры:</label>
            <div className="btn-group">
              <button
                className={!isMultiplayer ? 'active' : ''}
                onClick={() => handleGameModeToggle(false)}
              >
                <span className="btn-icon"></span>
                <span className="btn-text">
                  <strong>Одиночная игра</strong>
                  <small>Играть локально</small>
                </span>
              </button>
              <button
                className={isMultiplayer ? 'active' : ''}
                onClick={() => handleGameModeToggle(true)}
              >
                <span className="btn-icon">🌐</span>
                <span className="btn-text">
                  <strong>Онлайн (несколько команд)</strong>
                  <small>Играть против других</small>
                </span>
              </button>
            </div>
          </div>

          {isMultiplayer && (
            <div className="session-code-input">
              <label>Код сессии (6 символов):</label>
              <div className="session-code-row">
                <input
                  type="text"
                  placeholder={sessionCode || "Генерация кода..."}
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="session-input"
                />
                <button
                  className="generate-btn"
                  onClick={() => generateSessionCode()}
                  type="button"
                >
                  Обновить код
                </button>
              </div>
              <p className="session-hint">
                💡 Код создан автоматически. Вы можете изменить его вручную или сгенерировать новый.
                Поделитесь этим кодом с другими командами для подключения к одной сессии.
              </p>
            </div>
          )}

          <div className="team-name-input">
            <label>Название команды:</label>
            <input
              type="text"
              placeholder="Введите название команды"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={50}
            />
            <div className="hint">
              <span className="hint-icon">💡</span>
              <span>Например: "Стражи Галактики", "Новаторы", "Технократы"</span>
            </div>
          </div>

          <div className="experience-selector">
            <label>Уровень опыта команды:</label>
            <div className="btn-group">
              <button
                className={experienceLevel === 'student' ? 'active' : ''}
                onClick={() => handleExperienceChange('student')}
              >
                <span className="btn-icon"></span>
                <span className="btn-text">
                  <strong>Студенты</strong>
                  <small>{getBudgetForLevel('student').toLocaleString('ru-RU')} млн ₽</small>
                </span>
              </button>
              <button
                className={experienceLevel === 'professional' ? 'active' : ''}
                onClick={() => handleExperienceChange('professional')}
              >
                <span className="btn-icon"></span>
                <span className="btn-text">
                  <strong>Профессионалы</strong>
                  <small>{getBudgetForLevel('professional').toLocaleString('ru-RU')} млн ₽</small>
                </span>
              </button>
            </div>
          </div>

          <div className="team-size-selector">
            <label>Размер команды (1-5 человек):</label>
            <div className="btn-group">
              {[1, 2, 3, 4, 5].map(size => (
                <button
                  key={size}
                  className={teamSize === size ? 'active' : ''}
                  onClick={() => handleTeamSizeChange(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="team-members">
            {teamMembers.map((member, idx) => (
              <div key={idx} className="member-card">
                <h4>Член команды {idx + 1}</h4>
                <input
                  type="text"
                  placeholder="Введите имя"
                  value={member.name}
                  onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                  className="name-input"
                />
                <select
                  value={member.role}
                  onChange={(e) => updateTeamMember(idx, 'role', e.target.value)}
                  className="role-select"
                >
                  <option value="Геолог">Геолог</option>
                  <option value="Геофизик">Геофизик</option>
                  <option value="Инженер">Инженер по бурению</option>
                  <option value="Экономист">Экономист</option>
                  <option value="Менеджер">Менеджер проекта</option>
                </select>
              </div>
            ))}
          </div>

          <div className="budget-preview">
            <div className="budget-card">
              <span className="budget-icon">💰</span>
              <div className="budget-info">
                <h3>Стартовый бюджет</h3>
                <p className="budget-amount">
                  {currentBudget.toLocaleString('ru-RU')} млн ₽
                </p>
                <p className="budget-note">
                  {experienceLevel === 'student'
                    ? 'Увеличенный бюджет для обучения'
                    : 'Стандартный бюджет для специалистов'}
                </p>
              </div>
            </div>
          </div>

          <button
            className="btn-primary btn-large"
            onClick={handleSaveTeam}
            disabled={!canProceed}
          >
            {isMultiplayer
              ? `Подключиться к сессии ${sessionCode || '...'}`
              : 'Продолжить → К карте региона'}
          </button>

          {!canProceed && (
            <p className="error-message">
              Заполните название команды, имена всех участников
              {isMultiplayer && ' и код сессии'}
            </p>
          )}
        </div>
      </main>

      <footer className="lobby-footer">
        <p>💡 Совет: Выбирайте роли в команде осознанно — каждая специальность важна!</p>
      </footer>
    </div>
  );
};

export default GameLobby;