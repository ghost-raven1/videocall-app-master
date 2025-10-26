<template>
  <div class="landing-page">
    <header class="header">
      <div class="container">
        <div class="logo">{{ $t('landing.appName') }}</div>
        <nav class="nav">
          <router-link to="/login" class="nav-link">{{ $t('landing.login') }}</router-link>
          <router-link to="/join" class="nav-link primary">{{ $t('landing.joinMeeting') }}</router-link>
        </nav>
      </div>
    </header>
    
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h1>{{ $t('landing.heroTitle') }}</h1>
          <p>{{ $t('landing.heroSubtitle') }}</p>
          <div class="hero-buttons">
            <router-link to="/join" class="btn btn-primary">{{ $t('landing.startNow') }}</router-link>
            <a href="#features" class="btn btn-secondary">{{ $t('landing.learnMore') }}</a>
          </div>
        </div>
        <div class="hero-image">
          <img src="../assets/hero-image.svg" alt="Video conference" />
        </div>
      </div>
    </section>
    
    <section id="features" class="features">
      <div class="container">
        <h2>{{ $t('landing.featuresTitle') }}</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">📹</div>
            <h3>{{ $t('landing.feature1Title') }}</h3>
            <p>{{ $t('landing.feature1Desc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💬</div>
            <h3>{{ $t('landing.feature2Title') }}</h3>
            <p>{{ $t('landing.feature2Desc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>{{ $t('landing.feature3Title') }}</h3>
            <p>{{ $t('landing.feature3Desc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>{{ $t('landing.feature4Title') }}</h3>
            <p>{{ $t('landing.feature4Desc') }}</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="cta">
      <div class="container">
        <h2>{{ $t('landing.ctaTitle') }}</h2>
        <p>{{ $t('landing.ctaSubtitle') }}</p>
        <router-link to="/join" class="btn btn-primary">{{ $t('landing.startFreeCall') }}</router-link>
      </div>
    </section>
    
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-logo">{{ $t('landing.appName') }}</div>
          <div class="footer-links">
            <a href="#" class="footer-link">{{ $t('landing.termsOfService') }}</a>
            <a href="#" class="footer-link">{{ $t('landing.privacyPolicy') }}</a>
            <a href="#" class="footer-link">{{ $t('landing.contact') }}</a>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© 2023 {{ $t('landing.appName') }}. {{ $t('landing.allRightsReserved') }}</p>
          <div class="language-selector">
            <select v-model="$i18n.locale">
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped>
.landing-page {
  font-family: 'Inter', sans-serif;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  padding: 20px 0;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 24px;
  font-weight: 700;
  color: #4f46e5;
}

.nav {
  display: flex;
  gap: 20px;
}

.nav-link {
  text-decoration: none;
  color: #333;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  color: #4f46e5;
}

.nav-link.primary {
  background-color: #4f46e5;
  color: white;
}

.nav-link.primary:hover {
  background-color: #4338ca;
  color: white;
}

.hero {
  padding: 80px 0;
  background: linear-gradient(135deg, #f0f4ff 0%, #e6f0ff 100%);
}

.hero .container {
  display: flex;
  align-items: center;
  gap: 40px;
}

.hero-content {
  flex: 1;
}

.hero-image {
  flex: 1;
  display: flex;
  justify-content: center;
}

.hero-image img {
  max-width: 100%;
  height: auto;
}

h1 {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 20px;
  color: #1e293b;
  line-height: 1.2;
}

.hero p {
  font-size: 18px;
  margin-bottom: 30px;
  color: #64748b;
  line-height: 1.6;
}

.hero-buttons {
  display: flex;
  gap: 16px;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background-color: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.btn-secondary {
  background-color: white;
  color: #4f46e5;
  border: 1px solid #4f46e5;
}

.btn-secondary:hover {
  background-color: #f5f5ff;
  transform: translateY(-2px);
}

.features {
  padding: 100px 0;
  background-color: #fff;
}

.features h2 {
  text-align: center;
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 60px;
  color: #1e293b;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
}

.feature-card {
  background-color: #f8fafc;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 36px;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #1e293b;
}

.feature-card p {
  color: #64748b;
  line-height: 1.6;
}

.cta {
  padding: 80px 0;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: white;
  text-align: center;
}

.cta h2 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 20px;
}

.cta p {
  font-size: 18px;
  margin-bottom: 30px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  opacity: 0.9;
}

.cta .btn-primary {
  background-color: white;
  color: #4f46e5;
  padding: 14px 32px;
  font-size: 18px;
}

.cta .btn-primary:hover {
  background-color: #f8fafc;
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.3);
}

.footer {
  background-color: #1e293b;
  color: white;
  padding: 60px 0 30px;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.footer-logo {
  font-size: 24px;
  font-weight: 700;
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-link {
  color: #cbd5e1;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: white;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px;
  color: #94a3b8;
}

.language-selector select {
  background-color: #334155;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .hero .container {
    flex-direction: column;
  }
  
  .hero-content {
    text-align: center;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .footer-bottom {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
}
</style>