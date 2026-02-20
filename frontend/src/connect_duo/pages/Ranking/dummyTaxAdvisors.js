export const dummyTaxAdvisors = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `세무사 ${i + 1}`,
    photo: `https://randomuser.me/api/portraits/men/${(i % 10) + 10}.jpg`,
    desc: `전문 분야: ${['상속세', '법인세', '부가가치세', '종합소득세'][i % 4]}`,
    stats: {
        recommendCount: 10 + i,
        satisfaction: 95 - (i % 5),
        reConsultRate: 80 + (i % 10),
        consultCount: 100 + i * 3,
        avgReplyHours: 1 + (i % 3),
    },
}));
