export const PIPELINE_START_MESSAGE = 'В регионе отсутствует нефтяная инфраструктура. Нефтепровода нет, но по слухам он может пройти через территорию крупного недропользователя, уже получившего участки от государства';

const OLD_PIPELINE_ROUTE_MESSAGE = 'Нефтепровод можно проложить через участки материнской компании с запада на восток.';

export const DEFAULT_CASE_INTRO = {
  title: 'Кейс',
  paragraphs: [
    'В стране растёт интерес компаний к новому потенциально нефтеносному району.',
    PIPELINE_START_MESSAGE,
    'По данным федеральных научных институтов, перспективы связаны с карбонатным комплексом платформенного типа.',
    'На западе расположен складчато-надвиговый комплекс, где целевые объекты могут выходить на поверхность.',
    'Изученность района крайне низкая: сейсморазведка 2D почти отсутствует, бурение не проводилось.',
    'По периметру пробурены параметрические скважины, примыкающие к зоне лицензирования.',
    'В районе нет нефтяной инфраструктуры.',
  ],
  buttonText: 'Начать работу →',
};

export function getCaseIntroParagraphs(paragraphs = DEFAULT_CASE_INTRO.paragraphs) {
  const otherParagraphs = paragraphs
    .map(paragraph => paragraph.replace(OLD_PIPELINE_ROUTE_MESSAGE, '').replace(PIPELINE_START_MESSAGE, '').trim())
    .filter(Boolean);
  otherParagraphs.splice(Math.min(1, otherParagraphs.length), 0, PIPELINE_START_MESSAGE);
  return otherParagraphs;
}
