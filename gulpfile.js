var gulp = require('gulp'),
  jade = require('gulp-jade');

gulp.task('default', ['build', 'watch']);

gulp.task('build', ['install-deps', 'templates']);

gulp.task('watch', ['watch-templates']);

gulp.task('templates', function() {
  gulp.src('./src/*.jade')
    .pipe(jade())
    .pipe(gulp.dest('./pub/'))
});

gulp.task('watch-templates', function() {
  gulp.watch('./src/*.jade', ['templates'])
    .on('change', function(e) {
      console.log('File ' + e.path + ' was ' + e.type + ', running tasks...');
    });
});

gulp.task('install-deps', function() {
  gulp.src([
    './node_modules/bootstrap/dist/js/bootstrap.min.js',
    './node_modules/angular/angular.min.js',
    './node_modules/angular/angular.min.js.map'
  ]).pipe(gulp.dest('./pub/js/'));

  gulp.src([
    './node_modules/bootstrap/dist/css/bootstrap-theme.min.css',
    './node_modules/bootstrap/dist/css/bootstrap-theme.css.map',
    './node_modules/bootstrap/dist/css/bootstrap.min.css',
    './node_modules/bootstrap/dist/css/bootstrap.css.map',
    './node_modules/angular/angular-csp.css'
  ]).pipe(gulp.dest('./pub/css/'));

  gulp.src('./node_modules/bootstrap/dist/fonts/*')
    .pipe(gulp.dest('./pub/fonts/'));
});