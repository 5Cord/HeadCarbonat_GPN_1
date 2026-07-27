// faciesPresets.js
// Готовые карты фаций региона. Админ выбирает пресет по id — редактировать содержимое нельзя.
// Чтобы добавить новую карту: дописать объект в FACIES_PRESETS_RAW.

import { parseFaciesPreset } from './faciesUtils.js';

const FACIES_PRESETS_RAW = [
    {
        id: 'facies_1',
        name: 'Пресет №1',
        matrix: {
            width: 10,
            height: 10,
            legend: {
                'ПО': { name: 'Пойма/отмели' },
                'Р':  { name: 'Реки' },
                'Д':  { name: 'Дельты' },
                'ВД': { name: 'Врезанные долины' },
                'П':  { name: 'Пляжи' },
                'ГК': { name: 'Глубоков конуса' },
                'ГГ': { name: 'Глубоков глины' },
            },
            grid: [
                ['ГГ', 'ГГ', 'ГГ', 'ГГ', 'ГГ', 'ГГ', 'ГГ', 'ГГ', 'ГК', 'П'],
                ['ГГ', 'ГГ', 'ГГ', 'ГК', 'ГК', 'ГК', 'ГГ', 'ГК', 'Д', 'Д'],
                ['ГГ', 'ГК', 'ГК', 'ГГ', 'ГК', 'П(в центре скважина)', 'Д(в центре скважина)', 'Д', 'Р', 'Р'],
                ['Д', 'ВД', 'ГГ', 'ГК', 'П', 'Д(в центре скважина)', 'Д(в центре скважина)', 'Д', 'ПО', 'ПО'],
                ['ПО', 'ВД', 'ГК', 'ГГ', 'П', 'Д', 'Д', 'Д', 'ПО', 'Р'],
                ['ВД', 'ВД', 'ГК', 'ГГ', 'ГК', 'Д', 'Р', 'ПО', 'Р', 'ПО'],
                ['ВД', 'Д', 'Д', 'ГГ', 'ГГ', 'Д', 'ПО', 'Р', 'Р', 'Р'],
                ['ВД', 'ПО', 'Д', 'ГК', 'ГГ', 'ГК', 'ГК', 'ГГ', 'Р', 'Р'],
                ['ПО', 'Р', 'Д', 'ГГ', 'ГГ', 'ГК', 'Д', 'Р', 'ПО', 'ПО'],
                ['Р', 'ПО', 'ПО', 'ГГ', 'ГК', 'ГК', 'Д', 'ПО', 'Р', 'ПО'],
            ],
        },
    },
];

export const FACIES_PRESETS = FACIES_PRESETS_RAW.map(p => ({
    id: p.id,
    name: p.name,
    config: parseFaciesPreset(p.matrix),
}));

export function getFaciesPresetById(id) {
    if (!id) return null;
    return FACIES_PRESETS.find(p => p.id === id) ?? null;
}

export function getFaciesConfigById(id) {
    return getFaciesPresetById(id)?.config ?? null;
}
