export async function getKYCData(_address: string): Promise<{
    verified: boolean;
    expiry: number | null;
    documentType: string | null;
  }> {
    // Используем параметр, чтобы ESLint не жаловался на неиспользуемую переменную
    void _address;
    // Для тестирования возвращаем фиктивные данные
    return {
      verified: true,
      expiry: Math.floor(Date.now() / 1000) + 3600, // действителен ещё час
      documentType: "Внутренний паспорт",
    };
  }
  